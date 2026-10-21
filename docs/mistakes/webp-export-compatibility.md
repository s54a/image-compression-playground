# Check image encoding support before compression

## What happened

The default WebP output failed in Safari/WebKit, with no automatic fallback.

## Impact

Users could open valid images but could not finish compression using the default format.

## Why it happened

WebP decoding support was treated as WebP canvas encoding support. Unsupported export formats can silently produce PNG.

## Learning and required prevention

Probe the actual export MIME type before choosing WebP. Fall back to JPEG for JPEG sources and PNG for other sources to preserve possible transparency. Keep output MIME types, labels, and file extensions aligned. Verify fallback as well as native WebP before shipping encoding changes.
