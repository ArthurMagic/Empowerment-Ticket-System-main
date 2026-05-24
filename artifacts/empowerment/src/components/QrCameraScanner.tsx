import { useEffect, useRef } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";

interface QrCameraScannerProps {
  onScan: (token: string) => void;
  active: boolean;
  locked?: boolean;
}

export function QrCameraScanner({ onScan, active, locked = false }: QrCameraScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    scannedRef.current = locked;

    const scanner = new Html5QrcodeScanner(
      "qr-camera-reader",
      {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        if (scannedRef.current) return;
        scannedRef.current = true;
        // Extract token: if it looks like a URL, take the last path segment
        let token = decodedText.trim();
        if (token.includes("/")) {
          const parts = token.split("/");
          token = parts[parts.length - 1] ?? token;
        }
        onScan(token);
        // Do NOT auto-reset if locked - wait for external reset
      },
      (error) => {
        // Suppress routine "not found" errors
        void error;
      }
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [active, onScan, locked]);

  return (
    <div ref={containerRef} className={active ? "block" : "hidden"}>
      <div id="qr-camera-reader" className="rounded-xl overflow-hidden" />
    </div>
  );
}
