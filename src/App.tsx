import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import imageCompression from "browser-image-compression";

type ImageInfo = { file: File; url: string; width: number; height: number };
type Result = ImageInfo & { elapsed: number; targetBytes: number; downloadName: string };
type Status = "idle" | "loading" | "compressing" | "done" | "cancelled" | "error";
type Format = "image/webp" | "image/jpeg" | "image/png";
type Theme = "light" | "dark";
type Level = "detail" | "balanced" | "small";
const extensions: Record<Format, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const levels: { id: Level; label: string; description: string; quality: number; target: string; dimension: string }[] = [
  { id: "detail", label: "High detail", description: "Keep more texture", quality: 92, target: "350", dimension: "2560" },
  { id: "balanced", label: "Balanced", description: "A little of both", quality: 82, target: "200", dimension: "1920" },
  { id: "small", label: "Small file", description: "Make room", quality: 65, target: "100", dimension: "1280" },
];

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function dimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("This image could not be opened. Try another JPEG, PNG, or WebP file."));
    img.src = url;
  });
}

function supportedFile(file: File): File {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const supported: Record<string, Format> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  if (file.type === "image/gif" || extension === "gif") throw new Error("GIF images are not supported. Choose a still JPEG, PNG, or WebP image.");
  if (file.type.includes("hei") || extension === "heic" || extension === "heif") throw new Error("HEIC and HEIF images are not supported. Export the photo as JPEG first.");
  if (!file.size) throw new Error("This file is empty. Choose another image.");
  if (file.size > 20 * 1024 * 1024) throw new Error("This image is over 20 MB. Choose a smaller file.");
  const type = file.type || (extension ? supported[extension] : undefined);
  if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") throw new Error("Choose a JPEG, PNG, or WebP image. Other formats are not supported.");
  return file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
}

function initialTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function Comparison({ source, result, busy }: { source: ImageInfo | null; result: Result | null; busy: boolean }) {
  const [reveal, setReveal] = useState(50);
  const stageStyle: CSSProperties = { aspectRatio: source ? Math.max(0.8, Math.min(2.2, source.width / source.height)) : 1.5 };

  return <>
    <div className={`comparison-stage ${source ? "has-image" : ""} ${result ? "has-result" : ""}`} style={stageStyle}>
      {source ? <>
        <img className="comparison-image" src={source.url} alt="Original image" draggable={false} />
        {result && <>
          <div className="compressed-layer" style={{ clipPath: `inset(0 0 0 ${reveal}%)` }}>
            <img className="comparison-image" src={result.url} alt="Compressed image" draggable={false} />
          </div>
          <div className="reveal-divider" style={{ left: `${reveal}%` }} aria-hidden="true"><span className="reveal-handle"><svg width="24" height="20" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m8 6-4 4 4 4m8-8 4 4-4 4M12 4v12" /></svg></span></div>
          <input className="reveal-input" type="range" min="0" max="100" step="1" value={reveal} onChange={(event) => setReveal(Number(event.target.value))} aria-label="Compare original and compressed image" aria-valuetext={`${reveal}% original, ${100 - reveal}% compressed`} aria-describedby="comparison-help" />
        </>}
        <span className="image-tag original-tag">Original</span>
        {result ? <span className="image-tag compressed-tag">Compressed</span> : <span className="canvas-status">{busy ? "Compressing…" : "Original preview"}</span>}
      </> : <div className="empty-canvas"><svg aria-hidden="true" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="8" y="8" width="40" height="40" rx="3" /><circle cx="20" cy="20" r="4" /><path d="m8 39 12-12 10 10 7-7 11 11" /></svg><p>A closer look, a smaller file.</p><span>Choose an image to open your canvas.</span></div>}
    </div>
    <p id="comparison-help" className="comparison-help">{result ? "Drag the divider to compare. Use the arrow keys for a closer look." : source ? "Compress your image to compare both versions in the same frame." : "Your original and compressed image will line up here."}</p>
  </>;
}

export default function App() {
  const [source, setSource] = useState<ImageInfo | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState("200");
  const [maxDimension, setMaxDimension] = useState("1920");
  const [quality, setQuality] = useState(82);
  const [format, setFormat] = useState<Format>("image/webp");
  const [level, setLevel] = useState<Level | null>("balanced");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const task = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const sourceUrl = useRef<string | null>(null);
  const resultUrl = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.style.backgroundColor = theme === "dark" ? "#151a23" : "#f7f9fc";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#151a23" : "#f7f9fc");
    try { localStorage.setItem("compression-theme", theme); } catch { /* The selected theme still works when storage is unavailable. */ }
  }, [theme]);

  function stop() {
    task.current += 1;
    controller.current?.abort();
    controller.current = null;
  }

  function clearResult() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setResult(null);
  }

  function changeSettings() {
    if (result) {
      clearResult();
      setSettingsChanged(true);
    }
    setError("");
    setStatus("idle");
  }

  function selectLevel(next: (typeof levels)[number]) {
    changeSettings();
    setLevel(next.id);
    setTarget(next.target);
    setMaxDimension(next.dimension);
    setQuality(next.quality);
  }

  function reset() {
    stop();
    clearResult();
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    sourceUrl.current = null;
    setSource(null);
    setStatus("idle");
    setError("");
    setProgress(0);
    setSettingsChanged(false);
    if (picker.current) picker.current.value = "";
  }

  useEffect(() => () => {
    task.current += 1;
    controller.current?.abort();
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
  }, []);

  async function choose(files: FileList | null) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    reset();
    const currentTask = task.current;
    try {
      if (selectedFiles.length !== 1) throw new Error("Choose one image at a time.");
      const file = supportedFile(selectedFiles[0]);
      setStatus("loading");
      const url = URL.createObjectURL(file);
      sourceUrl.current = url;
      const imageDimensions = await dimensions(url);
      if (task.current !== currentTask) return;
      setSource({ file, url, ...imageDimensions });
      setStatus("idle");
    } catch (cause) {
      if (task.current !== currentTask) return;
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      sourceUrl.current = null;
      setError(cause instanceof Error ? cause.message : "This image could not be opened.");
      setStatus("error");
    }
  }

  async function compress() {
    if (!source) return;
    const targetKB = Number(target);
    const maxPixels = Number(maxDimension);
    if (!Number.isFinite(targetKB) || targetKB < 1 || targetKB > 20000 || !Number.isInteger(maxPixels) || maxPixels < 64 || maxPixels > 8192) {
      setError("Enter a target from 1 to 20,000 KB and a maximum dimension from 64 to 8,192 pixels.");
      return;
    }
    stop();
    clearResult();
    const currentTask = task.current;
    const abortController = new AbortController();
    controller.current = abortController;
    setError("");
    setProgress(0);
    setSettingsChanged(false);
    setStatus("compressing");
    const started = performance.now();
    try {
      const file = await imageCompression(source.file, {
        maxSizeMB: targetKB / 1024,
        maxWidthOrHeight: maxPixels,
        initialQuality: quality / 100,
        useWebWorker: true,
        libURL: new URL(`${import.meta.env.BASE_URL}vendor/browser-image-compression.js`, window.location.href).href,
        fileType: format,
        maxIteration: 20,
        preserveExif: false,
        signal: abortController.signal,
        onProgress: (value) => { if (task.current === currentTask) setProgress(value); },
      });
      if (task.current !== currentTask) return;
      if (file.type !== format) throw new Error("This browser could not encode the selected format. Try JPEG or PNG.");
      const url = URL.createObjectURL(file);
      resultUrl.current = url;
      const imageDimensions = await dimensions(url);
      if (task.current !== currentTask) return;
      const baseName = source.file.name.replace(/\.[^.]+$/, "") || "image";
      setResult({ file, url, ...imageDimensions, elapsed: performance.now() - started, targetBytes: targetKB * 1024, downloadName: `${baseName}-compressed.${extensions[format]}` });
      setProgress(100);
      setStatus("done");
    } catch (cause) {
      if (task.current !== currentTask) return;
      clearResult();
      setError(cause instanceof Error ? cause.message : "Compression failed. Try a smaller image or a different format.");
      setStatus("error");
    } finally {
      if (task.current === currentTask) controller.current = null;
    }
  }

  function cancel() {
    stop();
    clearResult();
    setStatus("cancelled");
    setProgress(0);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void choose(event.dataTransfer.files);
  }

  const busy = status === "compressing";
  const reduction = source && result ? (1 - result.file.size / source.file.size) * 100 : 0;
  const settingsValid = Number(target) >= 1 && Number(target) <= 20000 && Number.isInteger(Number(maxDimension)) && Number(maxDimension) >= 64 && Number(maxDimension) <= 8192;

  return <main>
    <header className="page-header">
      <div><h1>Image compression playground<span className="title-period">.</span></h1><p>Less weight. Keep what matters.</p></div>
      <button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
        {theme === "light" ? <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" /></svg> : <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>}
        <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
      </button>
    </header>

    <section className="workspace" aria-label="Image compression">
      <div className="controls">
        <div className="section-heading"><h2>Your image</h2>{source && <button className="text-button" onClick={reset}>Reset</button>}</div>
        <div className={`dropzone ${dragging ? "dragging" : ""} ${source ? "has-source" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          {source ? <p className="source-name" title={source.file.name}>{source.file.name}</p> : <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/></svg>}
          <button className="secondary-button" onClick={() => picker.current?.click()}>{source ? "Replace image" : "Choose image"}</button>
          {!source && <p>or drop it here</p>}<small>JPEG, PNG or WebP · up to 20 MB</small>
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => { void choose(event.target.files); }} className="file-input" aria-label="Choose image file" />
        </div>

        <fieldset className="level-settings" disabled={busy}>
          <legend>Compression level</legend>
          <div className="level-options">{levels.map((option) => <label className={`level-option ${level === option.id ? "selected" : ""}`} key={option.id}><input type="radio" name="compression-level" value={option.id} checked={level === option.id} onChange={() => selectLevel(option)} /><span><strong>{option.label}</strong><small>{option.description}</small></span><span className="radio-mark" aria-hidden="true" /></label>)}</div>
        </fieldset>

        <div className="quality-setting"><label htmlFor="quality">Quality ceiling <output htmlFor="quality">{quality}%</output></label><input id="quality" type="range" min="10" max="100" step="1" value={quality} disabled={busy} aria-describedby="quality-help" onChange={(event) => { changeSettings(); setLevel(null); setQuality(Number(event.target.value)); }} /><p id="quality-help" className="help">Compression may reduce quality further to reach the target. PNG is lossless.</p></div>
        <div className="settings">
          <label htmlFor="target-size">Target size<div className="input-unit"><input id="target-size" type="number" min="1" max="20000" inputMode="numeric" value={target} disabled={busy} onChange={(event) => { changeSettings(); setLevel(null); setTarget(event.target.value); }} /><span>KB</span></div></label>
          <label htmlFor="max-dimension">Longest side<div className="input-unit"><input id="max-dimension" type="number" min="64" max="8192" step="1" inputMode="numeric" value={maxDimension} disabled={busy} onChange={(event) => { changeSettings(); setLevel(null); setMaxDimension(event.target.value); }} /><span>px</span></div></label>
          <label className="format-label" htmlFor="output-format">Output format<select id="output-format" value={format} disabled={busy} onChange={(event) => { const value = event.target.value; if (value === "image/webp" || value === "image/jpeg" || value === "image/png") { changeSettings(); setFormat(value); } }}><option value="image/webp">WebP</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option></select></label>
        </div>
        <p className="help resize-help">Keeps the aspect ratio. Never enlarges your image. Target size is a goal, not a guarantee.</p>
        <button className="primary-button compress-button" disabled={!source || busy || !settingsValid} onClick={() => void compress()}>{busy ? "Compressing…" : result ? "Compress again" : "Compress image"}</button>
        <div className="feedback" aria-live="polite">
          {status === "loading" && <p>Opening image…</p>}
          {busy && <><div className="progress-label"><span>Compressing on your device</span><span>{Math.round(progress)}%</span></div><progress value={progress} max="100" aria-label="Compression progress" /><button className="text-button cancel-button" onClick={cancel}>Cancel compression</button></>}
          {status === "cancelled" && <p>Compression cancelled. Your original is still here.</p>}
          {settingsChanged && !busy && <p>Settings changed. Compress again to see the result.</p>}
          {error && <p className="error" role="alert">{error}</p>}
          {result && <p className="success">Done in {(result.elapsed / 1000).toFixed(2)} seconds.</p>}
        </div>
        <p className="local-note"><svg aria-hidden="true" width="15" height="17" viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="9" width="14" height="11" rx="2" /><path d="M6 9V6a4 4 0 0 1 8 0v3" /></svg> Your files stay on this device.</p>
      </div>

      <div className="comparison">
        <div className="section-heading comparison-heading"><h2>{result ? "See the difference" : "Your canvas"}</h2><span className="comparison-note">{result ? "Slide to compare" : "Original stays unchanged"}</span></div>
        <Comparison key={source?.url ?? "empty"} source={source} result={result} busy={busy} />
        {source && <div className="image-stats" aria-label="Image details">
          <div className="image-stat"><h3>Original <span>{source.file.type.replace("image/", "")}</span></h3><strong>{size(source.file.size)}</strong><p>{source.width} × {source.height} px</p></div>
          <div className={`image-stat ${result ? "result-stat" : ""}`}><h3>Compressed {result && <span>{result.file.type.replace("image/", "")}</span>}</h3><strong>{result ? size(result.file.size) : "—"}</strong><p>{result ? `${result.width} × ${result.height} px` : busy ? "Working on it…" : "Ready when you are"}</p></div>
          <div className={`image-stat savings-stat ${result ? "result-stat" : ""}`}><h3>{reduction < 0 ? "Size increase" : "Space saved"}</h3><strong>{result ? `${Math.abs(reduction).toFixed(1)}%` : "—"}</strong><p>{result ? `${size(Math.abs(source.file.size - result.file.size))} ${reduction < 0 ? "larger" : "saved"}` : "Every byte counts"}</p></div>
        </div>}
        {result && <div className="result-summary"><p><strong>{reduction >= 0 ? "Ready to go." : "This version is larger."}</strong><span>Actual output: {result.file.size.toLocaleString()} bytes</span></p><a className="primary-button download-button" href={result.url} download={result.downloadName}>Download image</a></div>}
        {result && result.file.size > result.targetBytes && <p className="warning" role="status">The result is above the {size(result.targetBytes)} target. Try a smaller longest side or a different output format.</p>}
        <p className="comparison-footnote">Check fine details before using your result. JPEG removes transparency; PNG may stay large.</p>
      </div>
    </section>
    <footer><span>Made for a lighter image.</span><span>Processed in your browser. Never uploaded.</span></footer>
  </main>;
}
