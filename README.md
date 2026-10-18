# Image compression playground

A separate, local browser experiment for trying `browser-image-compression` before any future admin integration. No backend, uploads, UploadThing, or credentials.

## Run

Requires Bun 1.4.3 and a current browser. Node 24 is used in CI.

```sh
bun install --frozen-lockfile
bun run dev
```

Open http://localhost:3005. The strict port prevents silently moving to another port.

```sh
bun run typecheck
bun run build
bun run preview
```

Preview serves the production build at http://localhost:4005. Build includes TypeScript checking. Automated tests and admin E2E are deferred.

## Try it on a phone

```sh
bun run dev --host 0.0.0.0
```

Connect your phone and computer to the same Wi-Fi network. Open `http://<computer-LAN-IP>:3005` on the phone. Allow local network access through the computer's firewall if needed. Do not expose the dev server to the public internet.

Choose or drop one JPEG, PNG, or still WebP. The defaults are WebP, a 200 KB target, and a 1,600 px maximum dimension. Compress, compare dimensions and actual bytes, then download. Try a transparent PNG with WebP and JPEG, a large photo, an image already below the target, cancellation, changing the selected file during compression, and an unsupported GIF or HEIC. Check the result at full size before using it.

## Limits and privacy

- Processing stays on the device. The app sends no image to a server and has no analytics. The browser still fetches the app and the local worker bundle from its host.
- A Bun prepare script copies the installed library bundle into `public/vendor/`. Compression requests a worker using this same-origin bundle, without loading third-party JavaScript from a CDN. The library can fall back to the main thread if workers are unavailable.
- The size target is approximate. The UI reports actual bytes and warns when the result misses the target. Some outputs can be larger than their originals.
- Canvas encoding, image dimensions, available memory, and CPU vary by browser and device. Large files can take time or fail. The maximum dimension preserves aspect ratio and does not upscale.
- Only JPEG, PNG, and WebP are accepted. Animated images are not preserved; GIF and HEIC/HEIF are rejected. Use still WebP images. JPEG cannot preserve transparency; PNG compression may not reach a small target. EXIF metadata is not preserved.
- The original local file is unchanged. Object URLs are released on replacement, reset, and unmount. Downloads use a new `-compressed` filename.

This repository has no connection to the fireworks admin app. No deployment is configured. The GitHub workflow installs the lockfile and builds on pushes and pull requests to `main`; it runs no tests.
