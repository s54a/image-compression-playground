import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import {
  formatExtensions,
  readImageDimensions,
  validateImageFile,
  type CompressionLevel,
  type CompressionPreset,
  type CompressionResult,
  type CompressionStatus,
  type ImageFormat,
  type ImageInfo,
} from "../lib/compression";

export function useImageCompression() {
  const [source, setSource] = useState<ImageInfo | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [status, setStatus] = useState<CompressionStatus>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState("200");
  const [maxDimension, setMaxDimension] = useState("1920");
  const [quality, setQuality] = useState(82);
  const [format, setFormat] = useState<ImageFormat>("image/webp");
  const [level, setLevel] = useState<CompressionLevel | null>("balanced");
  const [settingsChanged, setSettingsChanged] = useState(false);
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

  function changeSettings() {
    if (result) {
      clearResult();
      setSettingsChanged(true);
    }
    setError("");
    setStatus("idle");
  }

  function selectLevel(next: CompressionPreset) {
    changeSettings();
    setLevel(next.id);
    setTarget(next.target);
    setMaxDimension(next.dimension);
    setQuality(next.quality);
  }

  function changeTarget(value: string) {
    changeSettings();
    setLevel(null);
    setTarget(value);
  }

  function changeMaxDimension(value: string) {
    changeSettings();
    setLevel(null);
    setMaxDimension(value);
  }

  function changeQuality(value: number) {
    changeSettings();
    setLevel(null);
    setQuality(value);
  }

  function changeFormat(value: ImageFormat) {
    changeSettings();
    setFormat(value);
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
  }

  useEffect(
    () => () => {
      task.current += 1;
      controller.current?.abort();
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    },
    [],
  );

  async function choose(files: FileList | null) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    reset();
    const currentTask = task.current;
    try {
      if (selectedFiles.length !== 1)
        throw new Error("Choose one image at a time.");
      const file = validateImageFile(selectedFiles[0]);
      setStatus("loading");
      const url = URL.createObjectURL(file);
      sourceUrl.current = url;
      const imageDimensions = await readImageDimensions(url);
      if (task.current !== currentTask) return;
      setSource({ file, url, ...imageDimensions });
      setStatus("idle");
    } catch (cause) {
      if (task.current !== currentTask) return;
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      sourceUrl.current = null;
      setError(
        cause instanceof Error
          ? cause.message
          : "This image could not be opened.",
      );
      setStatus("error");
    }
  }

  async function compress() {
    if (!source) return;
    const targetKB = Number(target);
    const maxPixels = Number(maxDimension);
    if (
      !Number.isFinite(targetKB) ||
      targetKB < 1 ||
      targetKB > 20000 ||
      !Number.isInteger(maxPixels) ||
      maxPixels < 64 ||
      maxPixels > 8192
    ) {
      setError(
        "Enter a target from 1 to 20,000 KB and a maximum dimension from 64 to 8,192 pixels.",
      );
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
        libURL: new URL(
          `${import.meta.env.BASE_URL}vendor/browser-image-compression.js`,
          window.location.href,
        ).href,
        fileType: format,
        maxIteration: 20,
        preserveExif: false,
        signal: abortController.signal,
        onProgress: (value) => {
          if (task.current === currentTask) setProgress(value);
        },
      });
      if (task.current !== currentTask) return;
      if (file.type !== format)
        throw new Error(
          "This browser could not encode the selected format. Try JPEG or PNG.",
        );
      const url = URL.createObjectURL(file);
      resultUrl.current = url;
      const imageDimensions = await readImageDimensions(url);
      if (task.current !== currentTask) return;
      const baseName = source.file.name.replace(/\.[^.]+$/, "") || "image";
      setResult({
        file,
        url,
        ...imageDimensions,
        elapsed: performance.now() - started,
        targetBytes: targetKB * 1024,
        downloadName: `${baseName}-compressed.${formatExtensions[format]}`,
      });
      setProgress(100);
      setStatus("done");
    } catch (cause) {
      if (task.current !== currentTask) return;
      clearResult();
      setError(
        cause instanceof Error
          ? cause.message
          : "Compression failed. Try a smaller image or a different format.",
      );
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

  const busy = status === "compressing";
  const reduction =
    source && result ? (1 - result.file.size / source.file.size) * 100 : 0;
  const settingsValid =
    Number(target) >= 1 &&
    Number(target) <= 20000 &&
    Number.isInteger(Number(maxDimension)) &&
    Number(maxDimension) >= 64 &&
    Number(maxDimension) <= 8192;

  return {
    source,
    result,
    status,
    error,
    progress,
    target,
    maxDimension,
    quality,
    format,
    level,
    settingsChanged,
    busy,
    settingsValid,
    reduction,
    choose,
    compress,
    cancel,
    reset,
    selectLevel,
    changeTarget,
    changeMaxDimension,
    changeQuality,
    changeFormat,
  };
}

export type ImageCompression = ReturnType<typeof useImageCompression>;
