import { useState, type CSSProperties } from "react";
import { formatSize, type ImageInfo, type CompressionResult } from "../lib/compression";

export function ComparisonPreview({
  source,
  result,
  busy,
  reduction,
}: {
  source: ImageInfo | null;
  result: CompressionResult | null;
  busy: boolean;
  reduction: number;
}) {
  const [reveal, setReveal] = useState(50);
  const stageStyle: CSSProperties = {
    aspectRatio: source ? Math.max(0.8, Math.min(2.2, source.width / source.height)) : 1.5,
  };

  return (
    <div className="comparison">
      <div className="section-heading comparison-heading">
        <h2>{result ? "See the difference" : "Your canvas"}</h2>
        <span className="comparison-note">
          {result ? "Slide to compare" : "Original stays unchanged"}
        </span>
      </div>
      <>
        <div
          className={`comparison-stage ${source ? "has-image" : ""} ${result ? "has-result" : ""}`}
          style={stageStyle}
        >
          {source ? (
            <>
              <img
                className="comparison-image"
                src={source.url}
                alt="Original image"
                draggable={false}
              />
              {result && (
                <>
                  <div className="compressed-layer" style={{ clipPath: `inset(0 0 0 ${reveal}%)` }}>
                    <img
                      className="comparison-image"
                      src={result.url}
                      alt="Compressed image"
                      draggable={false}
                    />
                  </div>
                  <div className="reveal-divider" style={{ left: `${reveal}%` }} aria-hidden="true">
                    <span className="reveal-handle">
                      <svg
                        width="24"
                        height="20"
                        viewBox="0 0 24 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <path d="m8 6-4 4 4 4m8-8 4 4-4 4M12 4v12" />
                      </svg>
                    </span>
                  </div>
                  <input
                    className="reveal-input"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={reveal}
                    onChange={(event) => setReveal(Number(event.target.value))}
                    aria-label="Compare original and compressed image"
                    aria-valuetext={`${reveal}% original, ${100 - reveal}% compressed`}
                    aria-describedby="comparison-help"
                  />
                </>
              )}
              <span className="image-tag original-tag">Original</span>
              {result ? (
                <span className="image-tag compressed-tag">Compressed</span>
              ) : (
                <span className="canvas-status">{busy ? "Compressing…" : "Original preview"}</span>
              )}
            </>
          ) : (
            <div className="empty-canvas">
              <svg
                aria-hidden="true"
                width="56"
                height="56"
                viewBox="0 0 56 56"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
              >
                <rect x="8" y="8" width="40" height="40" rx="3" />
                <circle cx="20" cy="20" r="4" />
                <path d="m8 39 12-12 10 10 7-7 11 11" />
              </svg>
              <p>A closer look, a smaller file.</p>
              <span>Choose an image to open your canvas.</span>
            </div>
          )}
        </div>
        <p id="comparison-help" className="comparison-help">
          {result
            ? "Drag the divider to compare. Use the arrow keys for a closer look."
            : source
              ? "Compress your image to compare both versions in the same frame."
              : "Your original and compressed image will line up here."}
        </p>
      </>
      {source && (
        <div className="image-stats" aria-label="Image details">
          <div className="image-stat">
            <h3>
              Original <span>{source.file.type.replace("image/", "")}</span>
            </h3>
            <strong>{formatSize(source.file.size)}</strong>
            <p>
              {source.width} × {source.height} px
            </p>
          </div>
          <div className={`image-stat ${result ? "result-stat" : ""}`}>
            <h3>Compressed {result && <span>{result.file.type.replace("image/", "")}</span>}</h3>
            <strong>{result ? formatSize(result.file.size) : "—"}</strong>
            <p>
              {result
                ? `${result.width} × ${result.height} px`
                : busy
                  ? "Working on it…"
                  : "Ready when you are"}
            </p>
          </div>
          <div className={`image-stat savings-stat ${result ? "result-stat" : ""}`}>
            <h3>{reduction < 0 ? "Size increase" : "Space saved"}</h3>
            <strong>{result ? `${Math.abs(reduction).toFixed(1)}%` : "—"}</strong>
            <p>
              {result
                ? `${formatSize(Math.abs(source.file.size - result.file.size))} ${reduction < 0 ? "larger" : "saved"}`
                : "Every byte counts"}
            </p>
          </div>
        </div>
      )}
      {result && (
        <div className="result-summary">
          <p>
            <strong>{reduction >= 0 ? "Ready to go." : "This version is larger."}</strong>
            <span>Actual output: {result.file.size.toLocaleString()} bytes</span>
          </p>
          <a
            className="primary-button download-button"
            href={result.url}
            download={result.downloadName}
          >
            Download image
          </a>
        </div>
      )}
      {result && result.file.size > result.targetBytes && (
        <p className="warning" role="status">
          The result is above the {formatSize(result.targetBytes)} target. Try a smaller longest
          side or a different output format.
        </p>
      )}
      <p className="comparison-footnote">
        Check fine details before using your result. JPEG removes transparency; PNG may stay large.
      </p>
    </div>
  );
}
