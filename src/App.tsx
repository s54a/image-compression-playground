import { useEffect, useRef, useState, type DragEvent } from "react";
import imageCompression from "browser-image-compression";

type ImageInfo = { file: File; url: string; width: number; height: number };
type Result = ImageInfo & { elapsed: number; targetBytes: number; downloadName: string };
type Status = "idle" | "loading" | "compressing" | "done" | "cancelled" | "error";
type Format = "image/webp" | "image/jpeg" | "image/png";
const extensions: Record<Format, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

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
  const type = file.type || (extension ? supported[extension] : undefined);
  if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") throw new Error("Choose a JPEG, PNG, or WebP image. Other formats are not supported.");
  return file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
}

export default function App() {
  const [source, setSource] = useState<ImageInfo | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState("200");
  const [maxDimension, setMaxDimension] = useState("1600");
  const [format, setFormat] = useState<Format>("image/webp");
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const task = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const sourceUrl = useRef<string | null>(null);
  const resultUrl = useRef<string | null>(null);

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

  function reset() {
    stop();
    clearResult();
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    sourceUrl.current = null;
    setSource(null);
    setStatus("idle");
    setError("");
    setProgress(0);
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
    setStatus("compressing");
    const started = performance.now();
    try {
      const file = await imageCompression(source.file, {
        maxSizeMB: targetKB / 1024,
        maxWidthOrHeight: maxPixels,
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
      <div><p className="eyebrow">LOCAL EXPERIMENT</p><h1>Image compression playground</h1><p>Choose an image, compare the result, and download a smaller file.</p></div>
      <span className="privacy"><span aria-hidden="true">●</span> Stays on your device</span>
    </header>

    <section className="workspace" aria-label="Image compression">
      <div className="controls">
        <div className="section-heading"><h2>1. Choose an image</h2>{source && <button className="text-button" onClick={reset}>Reset</button>}</div>
        <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/></svg>
          <button className="secondary-button" onClick={() => picker.current?.click()}>{source ? "Choose another image" : "Choose image"}</button>
          <p>or drop a file here</p><small>JPEG, PNG or WebP · one image at a time</small>
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => { const files = event.target.files; void choose(files); }} className="file-input" aria-label="Choose image file" />
        </div>
        <h2 className="settings-heading">2. Set compression</h2>
        <div className="settings">
          <label>Target size <div className="input-unit"><input type="number" min="1" max="20000" value={target} disabled={busy} onChange={(event) => setTarget(event.target.value)} /><span>KB</span></div></label>
          <label>Maximum dimension <div className="input-unit"><input type="number" min="64" max="8192" step="1" value={maxDimension} disabled={busy} onChange={(event) => setMaxDimension(event.target.value)} /><span>px</span></div></label>
          <label className="format-label">Output format<select value={format} disabled={busy} onChange={(event) => { const value = event.target.value; if (value === "image/webp" || value === "image/jpeg" || value === "image/png") setFormat(value); }}><option value="image/webp">WebP</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option></select></label>
        </div>
        <p className="help">Keeps the aspect ratio and never enlarges the image. Target size is a goal, not a guarantee.</p>
        <button className="primary-button compress-button" disabled={!source || busy || !settingsValid} onClick={() => void compress()}>{busy ? "Compressing…" : "Compress image"}<span aria-hidden="true">→</span></button>
        <div className="feedback" aria-live="polite">
          {status === "loading" && <p>Opening image…</p>}
          {busy && <><div className="progress-label"><span>Compressing on your device</span><span>{Math.round(progress)}%</span></div><progress value={progress} max="100" aria-label="Compression progress" /><button className="text-button cancel-button" onClick={cancel}>Cancel compression</button></>}
          {status === "cancelled" && <p>Compression cancelled. Your original is still here.</p>}
          {error && <p className="error" role="alert">{error}</p>}
          {result && <p className="success">✓ Compression complete in {(result.elapsed / 1000).toFixed(2)}s</p>}
        </div>
        <p className="local-note">Files are processed in this browser. Nothing is uploaded or connected to the admin app.</p>
      </div>

      <div className="comparison">
        <div className="section-heading"><h2>3. Compare & download</h2><span className="comparison-note">Original stays unchanged</span></div>
        <div className="preview-grid">
          <article className="image-card"><div className="card-heading"><h3>Original</h3>{source && <span>{source.file.type.replace("image/", "").toUpperCase()}</span>}</div><div className="image-stage">{source ? <img src={source.url} alt="Original image preview" /> : <p>Your image will appear here</p>}</div><div className="image-details">{source ? <><strong>{size(source.file.size)}</strong><span>{source.width} × {source.height} px</span><p title={source.file.name}>{source.file.name}</p></> : <span>Choose an image to get started</span>}</div></article>
          <article className={`image-card ${result ? "result-card" : ""}`}><div className="card-heading"><h3>Compressed</h3>{result && <span>{result.file.type.replace("image/", "").toUpperCase()}</span>}</div><div className="image-stage">{result ? <img src={result.url} alt="Compressed image preview" /> : <p>{busy ? "Working on your image…" : "Your result will appear here"}</p>}</div><div className="image-details">{result ? <><strong>{size(result.file.size)}</strong><span>{result.width} × {result.height} px</span><p>{reduction >= 0 ? `${reduction.toFixed(1)}% smaller` : `${Math.abs(reduction).toFixed(1)}% larger than original`}</p></> : <span>Compress to see the difference</span>}</div></article>
        </div>
        {result && <div className="result-summary"><div><strong>{reduction >= 0 ? `${size(source!.file.size - result.file.size)} saved` : "Output is larger than the original"}</strong><p>Actual size: {result.file.size.toLocaleString()} bytes · {(result.elapsed / 1000).toFixed(2)}s</p></div><a className="primary-button download-button" href={result.url} download={result.downloadName}>Download image <span aria-hidden="true">↓</span></a></div>}
        {result && result.file.size > result.targetBytes && <p className="warning" role="status">The result is above the {size(result.targetBytes)} target. Try a smaller maximum dimension or a different output format.</p>}
        <p className="comparison-footnote">Check details and text at full size before using the result. Compression can reduce quality. JPEG removes transparency; PNG may stay large.</p>
      </div>
    </section>
    <footer>Browser image compression experiment <span>JPEG · PNG · WebP</span></footer>
  </main>;
}
