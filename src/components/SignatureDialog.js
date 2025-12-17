import React, { useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';

const Dialog = ({ children, open, onClose }) => {
  if (!open) return null;
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content signature-dialog" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

const SignatureDialog = ({ onSave, onClose }) => {
  const sigCanvas = useRef(null);

  useEffect(() => {
    const resizeCanvas = () => {
      if (sigCanvas.current) {
        const canvas = sigCanvas.current.getCanvas();
        const dialogContent = canvas.closest('.dialog-content');
        if (dialogContent) {
          const { width, height } = dialogContent.getBoundingClientRect();
          canvas.width = width * 0.95; 
          canvas.height = height * 0.65;
        }
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const handleSave = () => {
    if (sigCanvas.current) {
      const signature = sigCanvas.current.toDataURL();
      onSave(signature);
    }
  };

  const clearCanvas = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  return (
    <Dialog open={true} onClose={onClose}>
      <div className="dialog-header">
        <h2>Coletar Assinatura</h2>
        <p>Por favor, assine no campo abaixo.</p>
      </div>
      <div className="signature-dialog-canvas-container">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
        
          minWidth={2.5} // Define a espessura mínima do traço
          maxWidth={5}   // Define a espessura máxima do traço
          // ---------------------------------
          canvasProps={{ className: 'sigCanvas-popup' }}
        />
      </div>
      <div className="dialog-footer">
        <button type="button" onClick={clearCanvas}>
          Limpar
        </button>
        <button type="button" onClick={handleSave}>
          Salvar Assinatura
        </button>
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Dialog>
  );
};

export default SignatureDialog;