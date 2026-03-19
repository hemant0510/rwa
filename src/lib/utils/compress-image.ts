/**
 * Compress an image File using the browser Canvas API before upload.
 * - Images are resized to max 1200px on the longest side
 * - JPEG/WebP quality is set to 0.82
 * - PNG files are converted to JPEG (smaller) unless transparency needed
 * - PDFs and non-image types are returned unchanged
 */

const MAX_DIMENSION = 1200;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  // Only compress image types; PDFs pass through
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Downscale if either dimension exceeds MAX_DIMENSION
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // fallback: return original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert PNG to JPEG for smaller size (no alpha needed for ID/ownership docs)
      const outputType = file.type === "image/png" ? "image/jpeg" : file.type;
      const ext = outputType === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const outputName = file.name.replace(/\.[^.]+$/, `.${ext}`);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // fallback
            return;
          }
          resolve(new File([blob], outputName, { type: outputType }));
        },
        outputType,
        QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}
