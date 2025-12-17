import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

const SCANNER_ID = 'qr-reader';

const ScannerDialog = ({ onScanSuccess, onClose }) => {
    const scannerRef = useRef(null);
    const fileInputRef = useRef(null);

    const [isFlashOn, setIsFlashOn] = useState(false);
    const [isFlashAvailable, setFlashAvailable] = useState(false);

    const scannerInstanceRef = useRef(null);

    /* ---------- CSS customizado do html5-qrcode ---------- */
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            #html5-qrcode-button-camera-stop,
            #html5-qrcode-anchor-scan-type-change,
            #html5-qrcode-select-camera,
            #html5-qrcode-section-header {
                display: none !important;
            }

            #html5-qrcode-permission-dialog-title {
                font-size: 0 !important;
            }

            #html5-qrcode-permission-dialog-title::before {
                content: "Permita o uso da câmera";
                font-size: 1rem;
                color: #000;
            }

            #html5-qrcode-permission-button {
                font-size: 0 !important;
            }

            #html5-qrcode-permission-button::before {
                content: "Solicitar permissão de uso da câmera";
                font-size: 1rem;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    /* ---------- Inicialização do Scanner ---------- */
    useEffect(() => {
        if (!scannerRef.current) return;

        const scanner = new Html5QrcodeScanner(
            SCANNER_ID,
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                facingMode: "environment",
                showOpenFileButton: false,
            },
            false
        );

        scannerInstanceRef.current = scanner;

        const onSuccess = (decodedText) => {
            scanner.clear()
                .then(() => onScanSuccess(decodedText))
                .catch(() => onScanSuccess(decodedText));
        };

        scanner.render(onSuccess, () => {});

        const checkForFlash = () => {
            const container = document.getElementById(SCANNER_ID);
            if (!container) return;

            const video = container.querySelector('video');
            if (!video?.srcObject || video.readyState !== 4) {
                setTimeout(checkForFlash, 200);
                return;
            }

            const track = video.srcObject.getVideoTracks()?.[0];
            if (track?.getCapabilities?.().torch) {
                setFlashAvailable(true);
            }
        };

        checkForFlash();

        return () => {
            scanner.clear().catch(() => {});
        };
    }, [onScanSuccess]);

    /* ---------- Flash ---------- */
    const toggleFlash = () => {
        const container = document.getElementById(SCANNER_ID);
        const video = container?.querySelector('video');
        if (!video?.srcObject) return;

        const track = video.srcObject.getVideoTracks()?.[0];
        if (!track) return;

        track.applyConstraints({ advanced: [{ torch: !isFlashOn }] })
            .then(() => setIsFlashOn(prev => !prev))
            .catch(() => {});
    };

    /* ---------- Upload de imagem ---------- */
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const qr = new Html5Qrcode(SCANNER_ID);
            const result = await qr.scanFile(file, false);
            onScanSuccess(result);
        } catch {
            alert("Não foi possível ler o QR Code da imagem.");
        }
    };

    /* ---------- UI ---------- */
    return (
        <div className="dialog-overlay" onClick={onClose}>
            <div className="dialog-content" onClick={e => e.stopPropagation()}>
                <div className="dialog-header">
                    <h2>Escanear Código</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>

                <div className="dialog-body">
                    <div id={SCANNER_ID} ref={scannerRef} />

                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />

                    <button
                        className="custom-button"
                        onClick={() => fileInputRef.current.click()}
                    >
                        Carregar da Galeria
                    </button>

                    <button
                        className="custom-button stop-scan-button"
                        onClick={onClose}
                    >
                        Fechar Scanner
                    </button>

                    {isFlashAvailable && (
                        <button
                            className="custom-button flash-button"
                            onClick={toggleFlash}
                        >
                            {isFlashOn ? 'Desligar Flash' : 'Ligar Flash'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScannerDialog;
