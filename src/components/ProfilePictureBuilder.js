import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useContext,
} from "react";
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
  faSearchPlus,
  faSearchMinus,
  faRotateLeft,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { LanguageContext } from "../context/LanguageContext";
import { debounce, throttle } from "lodash";

const presetFrames = [
  { name: "Option 1", url: "/frames/option-1.png" },
  { name: "Option 2", url: "/frames/option-2.png" },
  { name: "Option 3", url: "/frames/option-3.png" },
  { name: "Option 4", url: "/frames/option-4.png" },
];

const ProfilePictureBuilder = () => {
  const { language, setLanguage, t } = useContext(LanguageContext);

  const [sourceImage, setSourceImage] = useState(null);
  const [frameImage, setFrameImage] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState("None");
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState([]);
  const [zoomValue, setZoomValue] = useState(100);
  const [dominantColor, setDominantColor] = useState(null);

  const canvasRef = useRef(null);
  const sourceImageRef = useRef(null);
  const frameImageRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const pinchDistance = useRef(null);

  const CANVAS_SIZE = 400;
  const MAX_OFFSET = 100;
  const MIN_SCALE = 0.2;
  const MAX_SCALE = 5;
  const MAX_IMAGE_SIZE = 1024;

  useEffect(() => {
    setZoomValue((scale * 100).toFixed(0));
  }, [scale]);

  const saveToHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev.slice(-9),
      { scale, position: { ...position }, rotation },
    ]);
  }, [scale, position, rotation]);

  const getDominantColor = (img) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0, img.width, img.height);

    const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
    const colorCount = {};

    for (let i = 0; i < imageData.length; i += 20) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3];

      if (a === 0) continue;

      const color = `${r},${g},${b}`;
      colorCount[color] = (colorCount[color] || 0) + 1;
    }

    let maxCount = 0;
    let dominant = "255,255,255";
    for (const [color, count] of Object.entries(colorCount)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = color;
      }
    }

    const [r, g, b] = dominant.split(",").map(Number);
    return `rgb(${r},${g},${b})`;
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
        const img = new Image();
        img.src = url;
        img.onload = () => {
          setSourceImage(url);
          sourceImageRef.current = img;
          setScale(1);
          setZoomValue(100);
          setPosition({ x: 0, y: 0 });
          setRotation(0);
          setHistory([]);
          const color = getDominantColor(img);
          setDominantColor(color);
        };
      });
    }
  };

  const handleFrameUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      preprocessImage(file, (url) => {
        const frame = new Image();
        frame.src = url;
        frame.onload = () => {
          setFrameImage(url);
          frameImageRef.current = frame;
          setSelectedPreset("None");
        };
      });
    }
  };

  const handlePresetSelect = (presetName) => {
    setSelectedPreset(presetName);
    const preset = presetFrames.find((frame) => frame.name === presetName);
    const frame = new Image();
    frame.src = preset.url;
    frame.onload = () => {
      frameImageRef.current = frame;
      setFrameImage(preset.url);
    };
  };

  const debouncedStateUpdate = useRef(
    debounce((newScale, newPosition, newRotation) => {
      setScale(newScale);
      setPosition(newPosition);
      setRotation(newRotation);
    }, 50)
  ).current;

  const handleZoomChange = useCallback(
    (e) => {
      const newZoom = Number(e.target.value);
      setZoomValue(newZoom);
      const newScale = newZoom / 100;
      saveToHistory();
      debouncedStateUpdate(
        Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale)),
        position,
        rotation
      );
    },
    [saveToHistory, position, rotation, debouncedStateUpdate]
  );

  const handleRotationChange = useCallback(
    (e) => {
      const newRotation = Number(e.target.value);
      saveToHistory();
      debouncedStateUpdate(scale, position, newRotation);
    },
    [saveToHistory, scale, position, debouncedStateUpdate]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = CANVAS_SIZE;
    offscreenCanvas.height = CANVAS_SIZE;
    const offscreenCtx = offscreenCanvas.getContext("2d");

    const drawCanvas = () => {
      offscreenCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      if (dominantColor) {
        offscreenCtx.fillStyle = dominantColor;
        offscreenCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }

      if (sourceImageRef.current) {
        const img = sourceImageRef.current;
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        offscreenCtx.save();
        offscreenCtx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
        offscreenCtx.rotate((rotation * Math.PI) / 180);
        offscreenCtx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);
        offscreenCtx.drawImage(
          img,
          position.x + (CANVAS_SIZE - scaledWidth) / 2,
          position.y + (CANVAS_SIZE - scaledHeight) / 2,
          scaledWidth,
          scaledHeight
        );
        offscreenCtx.restore();
      }

      if (frameImageRef.current) {
        offscreenCtx.drawImage(
          frameImageRef.current,
          0,
          0,
          CANVAS_SIZE,
          CANVAS_SIZE
        );
      }

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(offscreenCanvas, 0, 0);
    };

    let animationFrameId;
    const renderLoop = () => {
      drawCanvas();
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (sourceImage) URL.revokeObjectURL(sourceImage);
      if (frameImage) URL.revokeObjectURL(frameImage);
    };
  }, [sourceImage, frameImage, scale, position, rotation, dominantColor]);

  const handleMouseDown = useCallback(
    (e) => {
      if (!sourceImage) return;
      isDragging.current = true;
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      saveToHistory();
    },
    [sourceImage, position, saveToHistory]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging.current || !sourceImage) return;
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      setPosition({
        x: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newX)),
        y: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newY)),
      });
    },
    [sourceImage]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleTouchStart = useCallback(
    (e) => {
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
    },
    [sourceImage, position, saveToHistory]
  );

  const handleSingleTouchMove = useCallback((touch) => {
    const newX = touch.clientX - dragStart.current.x;
    const newY = touch.clientY - dragStart.current.y;
    setPosition({
      x: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newX)),
      y: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newY)),
    });
  }, []);

  const handlePinchMove = useCallback(
    (touches) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);

      if (!pinchDistance.current) {
        pinchDistance.current = newDistance;
        return;
      }

      const scaleChange = newDistance / pinchDistance.current;
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, scale * scaleChange)
      );

      const pinchCenterX = (touches[0].clientX + touches[1].clientX) / 2;
      const pinchCenterY = (touches[0].clientY + touches[1].clientY) / 2;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const canvasX = pinchCenterX - canvasRect.left - CANVAS_SIZE / 2;
      const canvasY = pinchCenterY - canvasRect.top - CANVAS_SIZE / 2;

      const newPositionX = position.x + (canvasX / scale - canvasX / newScale);
      const newPositionY = position.y + (canvasY / scale - canvasY / newScale);

      setScale(newScale);
      setPosition({
        x: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newPositionX)),
        y: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, newPositionY)),
      });

      pinchDistance.current = newDistance;
    },
    [scale, position]
  );

  // Throttled touch move handler
  // eslint-disable-next-line
  const handleTouchMove = useCallback(
    throttle(
      (event) => {
        if (!sourceImage) return;
        event.preventDefault();
        const { touches } = event;

        if (touches.length === 1 && isDragging.current) {
          handleSingleTouchMove(touches[0]);
        } else if (touches.length === 2) {
          handlePinchMove(touches);
        }
      },
      50,
      { leading: true, trailing: true }
    ),
    [sourceImage, handleSingleTouchMove, handlePinchMove, isDragging]
  );

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    isDragging.current = false;
    pinchDistance.current = null;
  }, []);

  const handleWheel = useCallback(
    (e) => {
      if (!sourceImage) return;
      e.preventDefault();
      saveToHistory();
      const zoomSpeed = 0.001;
      const delta = e.deltaY;
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, scale - delta * zoomSpeed)
      );
      setScale(newScale);
    },
    [sourceImage, scale, saveToHistory]
  );

  const throttledHandleWheel = useMemo(
    () => throttle(handleWheel, 50, { leading: true, trailing: true }),
    [handleWheel]
  );

  const handleKeyDown = useCallback(
    (e) => {
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
    },
    [sourceImage, scale, position, saveToHistory]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.addEventListener("wheel", throttledHandleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      canvas.removeEventListener("wheel", throttledHandleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [throttledHandleWheel, handleKeyDown]);

  const handleReset = useCallback(() => {
    saveToHistory();
    setScale(1);
    setZoomValue(100);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, [saveToHistory]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setScale(lastState.scale);
    setPosition({ ...lastState.position });
    setRotation(lastState.rotation);
    setHistory((prev) => prev.slice(0, -1));
  }, [history]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (dominantColor) {
      ctx.fillStyle = dominantColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (sourceImageRef.current) {
      const img = sourceImageRef.current;
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      ctx.save();
      ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);
      ctx.drawImage(
        img,
        position.x + (CANVAS_SIZE - scaledWidth) / 2,
        position.y + (CANVAS_SIZE - scaledHeight) / 2,
        scaledWidth,
        scaledHeight
      );
      ctx.restore();
    }

    if (frameImageRef.current) {
      ctx.drawImage(frameImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    canvas.toBlob((blob) => {
      saveAs(blob, "fb-profile-picture.png");
    });
  }, [dominantColor, scale, position, rotation]);

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
                <Col xs={6} key={frame.name} className="mb-2">
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
                          width: "150px",
                          height: "150px",
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
                          width: "150px",
                          height: "150px",
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
