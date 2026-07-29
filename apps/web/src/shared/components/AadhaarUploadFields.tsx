import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Images, LoaderCircle, X } from 'lucide-react';
import { ApiError } from '../services/api.client';
import { uploadAadhaarFile } from '../utils/aadhaarUpload';

type Side = 'front' | 'back';

type Preview = {
  url: string;
  isLocal: boolean;
  isPdf: boolean;
  name?: string;
};

type Props = {
  frontKey?: string;
  backKey?: string;
  frontUrl?: string | null;
  backUrl?: string | null;
  onChange: (next: { frontKey?: string; backKey?: string }) => void;
  disabled?: boolean;
};

function isPdfUrl(value?: string | null) {
  if (!value) return false;
  return /\.pdf($|\?)/i.test(value) || value.includes('application/pdf');
}

export function AadhaarUploadFields({
  frontKey,
  backKey,
  frontUrl,
  backUrl,
  onChange,
  disabled,
}: Props) {
  const [busy, setBusy] = useState<Side | null>(null);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState<{ front?: Preview; back?: Preview }>({});
  const cameraRefs = useRef<Record<Side, HTMLInputElement | null>>({ front: null, back: null });
  const galleryRefs = useRef<Record<Side, HTMLInputElement | null>>({ front: null, back: null });

  useEffect(() => {
    setPreviews((current) => ({
      front:
        current.front?.isLocal
          ? current.front
          : frontUrl
            ? { url: frontUrl, isLocal: false, isPdf: isPdfUrl(frontUrl) }
            : undefined,
      back:
        current.back?.isLocal
          ? current.back
          : backUrl
            ? { url: backUrl, isLocal: false, isPdf: isPdfUrl(backUrl) }
            : undefined,
    }));
  }, [frontUrl, backUrl]);

  useEffect(() => {
    return () => {
      for (const preview of Object.values(previews)) {
        if (preview?.isLocal) URL.revokeObjectURL(preview.url);
      }
    };
    // Intentionally only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPreview(side: Side, next?: Preview) {
    setPreviews((current) => {
      const previous = current[side];
      if (previous?.isLocal) URL.revokeObjectURL(previous.url);
      return { ...current, [side]: next };
    });
  }

  function clearSide(side: Side) {
    setPreview(side, undefined);
    onChange(
      side === 'front'
        ? { frontKey: undefined, backKey }
        : { frontKey, backKey: undefined },
    );
  }

  async function handleFile(side: Side, file?: File | null) {
    if (!file) return;
    setError('');
    setBusy(side);

    const tempUrl = URL.createObjectURL(file);
    setPreview(side, {
      url: tempUrl,
      isLocal: true,
      isPdf: file.type === 'application/pdf',
      name: file.name,
    });

    try {
      const uploaded = await uploadAadhaarFile(
        side === 'front' ? 'aadhaar-front' : 'aadhaar-back',
        file,
      );
      const previewFile = uploaded.file ?? file;
      const previewUrl = URL.createObjectURL(previewFile);
      setPreview(side, {
        url: previewUrl,
        isLocal: true,
        isPdf: previewFile.type === 'application/pdf',
        name: previewFile.name,
      });
      onChange(
        side === 'front'
          ? { frontKey: uploaded.key, backKey }
          : { frontKey, backKey: uploaded.key },
      );
    } catch (requestError) {
      setPreview(side, undefined);
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to upload Aadhaar image.',
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="aadhaar-upload-grid">
      {(
        [
          ['front', 'Aadhaar front', frontKey],
          ['back', 'Aadhaar back', backKey],
        ] as const
      ).map(([side, label, key]) => {
        const preview = previews[side];
        return (
          <div key={side} className="aadhaar-upload-field">
            <span>{label}</span>

            <input
              ref={(node) => {
                cameraRefs.current[side] = node;
              }}
              className="aadhaar-hidden-input"
              type="file"
              accept="image/*"
              capture="environment"
              disabled={disabled || Boolean(busy)}
              onChange={(event) => {
                const file = event.target.files?.[0];
                void handleFile(side, file);
                event.target.value = '';
              }}
            />
            <input
              ref={(node) => {
                galleryRefs.current[side] = node;
              }}
              className="aadhaar-hidden-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={disabled || Boolean(busy)}
              onChange={(event) => {
                const file = event.target.files?.[0];
                void handleFile(side, file);
                event.target.value = '';
              }}
            />

            {preview ? (
              <div className="aadhaar-preview">
                {preview.isPdf ? (
                  <a
                    className="aadhaar-preview-pdf"
                    href={preview.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText />
                    <em>{preview.name || 'PDF uploaded'}</em>
                  </a>
                ) : (
                  <a href={preview.url} target="_blank" rel="noreferrer">
                    <img src={preview.url} alt={`${label} preview`} />
                  </a>
                )}
                <div className="aadhaar-preview-actions">
                  <button
                    type="button"
                    className="aadhaar-preview-replace"
                    disabled={disabled || Boolean(busy)}
                    onClick={() => cameraRefs.current[side]?.click()}
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    className="aadhaar-preview-clear"
                    disabled={disabled || Boolean(busy)}
                    onClick={() => clearSide(side)}
                    aria-label={`Remove ${label}`}
                  >
                    <X />
                  </button>
                </div>
                {busy === side ? (
                  <span className="aadhaar-preview-status">
                    <LoaderCircle className="spin" /> Compressing…
                  </span>
                ) : key ? (
                  <span className="aadhaar-preview-status ready">Ready</span>
                ) : null}
              </div>
            ) : (
              <div className="aadhaar-capture-actions">
                <button
                  type="button"
                  className="aadhaar-capture-btn primary-capture"
                  disabled={disabled || Boolean(busy)}
                  onClick={() => cameraRefs.current[side]?.click()}
                >
                  {busy === side ? <LoaderCircle className="spin" /> : <Camera />}
                  {busy === side ? 'Uploading…' : 'Take photo'}
                </button>
                <button
                  type="button"
                  className="aadhaar-capture-btn"
                  disabled={disabled || Boolean(busy)}
                  onClick={() => galleryRefs.current[side]?.click()}
                >
                  <Images />
                  Gallery
                </button>
              </div>
            )}

            <small>Camera preferred · auto-compressed · JPG / PDF up to 10 MB</small>
          </div>
        );
      })}
      {error ? <p className="aadhaar-upload-error">{error}</p> : null}
    </div>
  );
}
