import { useRef, useState, type DragEvent } from "react";
import { compressionLevels } from "../lib/compression";
import type { ImageCompression } from "../hooks/useImageCompression";

type CompressionControlsProps = {
  compression: ImageCompression;
};

export function CompressionControls({ compression }: CompressionControlsProps) {
  const {
    source,
    result,
    status,
    error,
    formatNotice,
    progress,
    target,
    maxDimension,
    quality,
    format,
    settingsChanged,
    busy,
    settingsValid,
    choose,
    compress,
    cancel,
    reset,
    selectLevel,
    changeTarget,
    changeMaxDimension,
    changeQuality,
    changeFormat,
  } = compression;
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void choose(event.dataTransfer.files);
  }

  return (
    <div className="controls">
      <div className="section-heading">
        <h2>Your image</h2>
        {source && (
          <button className="text-button" onClick={reset}>
            Reset
          </button>
        )}
      </div>
      <div
        className={`dropzone ${dragging ? "dragging" : ""} ${source ? "has-source" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        {source ? (
          <p className="source-name" title={source.file.name}>
            {source.file.name}
          </p>
        ) : (
          <svg
            aria-hidden="true"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8" cy="8" r="1.5" />
            <path d="m3 16 5-5 5 5 3-3 5 5" />
          </svg>
        )}
        <button
          className="secondary-button"
          onClick={() => picker.current?.click()}
        >
          {source ? "Replace image" : "Choose image"}
        </button>
        {!source && <p>or drop it here</p>}
        <small>JPEG, PNG or WebP · up to 20 MB</small>
        <input
          ref={picker}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={(event) => {
            void choose(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
          className="file-input"
          aria-label="Choose image file"
        />
      </div>

      <fieldset className="level-settings" disabled={busy}>
        <legend>Compression level</legend>
        <div className="level-options">
          {compressionLevels.map((option) => (
            <label
              className={`level-option ${compression.level === option.id ? "selected" : ""}`}
              key={option.id}
            >
              <input
                type="radio"
                name="compression-level"
                value={option.id}
                checked={compression.level === option.id}
                onChange={() => selectLevel(option)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              <span className="radio-mark" aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="quality-setting">
        <label htmlFor="quality">
          Quality ceiling <output htmlFor="quality">{quality}%</output>
        </label>
        <input
          id="quality"
          type="range"
          min="10"
          max="100"
          step="1"
          value={quality}
          disabled={busy}
          aria-describedby="quality-help"
          onChange={(event) => changeQuality(Number(event.target.value))}
        />
        <p id="quality-help" className="help">
          Compression may reduce quality further to reach the target. PNG is
          lossless.
        </p>
      </div>
      <div className="settings">
        <label htmlFor="target-size">
          Target size
          <div className="input-unit">
            <input
              id="target-size"
              type="number"
              min="1"
              max="20000"
              inputMode="numeric"
              value={target}
              disabled={busy}
              onChange={(event) => changeTarget(event.target.value)}
            />
            <span>KB</span>
          </div>
        </label>
        <label htmlFor="max-dimension">
          Longest side
          <div className="input-unit">
            <input
              id="max-dimension"
              type="number"
              min="64"
              max="8192"
              step="1"
              inputMode="numeric"
              value={maxDimension}
              disabled={busy}
              onChange={(event) => changeMaxDimension(event.target.value)}
            />
            <span>px</span>
          </div>
        </label>
        <label className="format-label" htmlFor="output-format">
          Output format
          <select
            id="output-format"
            value={format}
            disabled={busy}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "image/webp" ||
                value === "image/jpeg" ||
                value === "image/png"
              ) {
                changeFormat(value);
              }
            }}
          >
            <option value="image/webp">WebP</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/png">PNG</option>
          </select>
        </label>
      </div>
      <p className="help">
        Safari/WebKit browsers, including most iPhone and iPad browsers, cannot
        export WebP. We automatically use JPEG or PNG instead. PNG preserves
        transparency but may produce larger files.
      </p>
      <p className="help resize-help">
        Keeps the aspect ratio. Never enlarges your image. Target size is a
        goal, not a guarantee.
      </p>
      <button
        className="primary-button compress-button"
        disabled={!source || busy || !settingsValid}
        onClick={() => void compress()}
      >
        {busy ? "Compressing…" : result ? "Compress again" : "Compress image"}
      </button>
      <div className="feedback" aria-live="polite">
        {formatNotice && <p>{formatNotice}</p>}
        {status === "loading" && <p>Opening image…</p>}
        {busy && (
          <>
            <div className="progress-label">
              <span>Compressing on your device</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <progress
              value={progress}
              max="100"
              aria-label="Compression progress"
            />
            <button className="text-button cancel-button" onClick={cancel}>
              Cancel compression
            </button>
          </>
        )}
        {status === "cancelled" && (
          <p>Compression cancelled. Your original is still here.</p>
        )}
        {settingsChanged && !busy && (
          <p>Settings changed. Compress again to see the result.</p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <p className="success">
            Done in {(result.elapsed / 1000).toFixed(2)} seconds.
          </p>
        )}
      </div>
      <p className="local-note">
        <svg
          aria-hidden="true"
          width="15"
          height="17"
          viewBox="0 0 20 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="9" width="14" height="11" rx="2" />
          <path d="M6 9V6a4 4 0 0 1 8 0v3" />
        </svg>{" "}
        Your files stay on this device.
      </p>
    </div>
  );
}
