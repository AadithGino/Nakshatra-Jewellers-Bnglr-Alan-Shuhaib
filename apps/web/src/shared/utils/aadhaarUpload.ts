import { api, ApiError } from '../services/api.client';

type UploadKind = 'aadhaar-front' | 'aadhaar-back';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.62;
const MAX_BYTES = 10_485_760;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read image'));
    };
    image.src = url;
  });
}

/** Downscale + JPEG compress field photos for faster mobile uploads. */
export async function compressAadhaarImage(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;
  if (!file.type.startsWith('image/')) return file;

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return file;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) return file;

  // Keep original if compression somehow got larger.
  if (blob.size >= file.size && file.type === 'image/jpeg' && scale === 1) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'aadhaar';
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export async function uploadAadhaarFile(kind: UploadKind, file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ApiError('INVALID_FILE_TYPE', 'Use camera photo, JPG, PNG, WEBP or PDF only.', 415);
  }

  if (file.size > MAX_BYTES) {
    throw new ApiError('FILE_TOO_LARGE', 'File exceeds the maximum allowed size (10 MB).', 413);
  }

  const prepared = file.type.startsWith('image/') ? await compressAadhaarImage(file) : file;

  if (prepared.size > MAX_BYTES) {
    throw new ApiError('FILE_TOO_LARGE', 'Compressed file is still too large. Try another photo.', 413);
  }

  const uploaded = await api<{ key: string }>('/uploads?kind=' + encodeURIComponent(kind), {
    method: 'POST',
    headers: {
      'content-type': prepared.type,
      'x-upload-kind': kind,
      'x-file-content-type': prepared.type,
    },
    body: prepared,
  });

  return { key: uploaded.key, fileName: prepared.name, file: prepared };
}
