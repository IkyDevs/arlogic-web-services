'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Download, X, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';

interface QRCodeGeneratorProps {
  invoiceNumber: string;
  token: string;
  customerName: string;
  onClose?: () => void;
}

export default function QRCodeGenerator({ invoiceNumber, token, customerName, onClose }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const trackingUrl = `${appUrl}/tracking/${invoiceNumber}?token=${token}`;

  useEffect(() => {
    generateQR();
  }, [invoiceNumber, token]);

  const generateQR = async () => {
    try {
      const url = await QRCode.toDataURL(trackingUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1A1A1A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('QR generation error:', err);
      toast.error('Failed to generate QR code');
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `QR_${invoiceNumber}.png`;
    link.href = qrDataUrl;
    link.click();
    toast.success('QR Code downloaded!');
  };

  const downloadWithLabel = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 360;
    canvas.height = 460;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Header bg
    ctx.fillStyle = '#FF6B9D';
    ctx.fillRect(2, 2, canvas.width - 4, 64);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WATCH SERVICE', canvas.width / 2, 32);
    ctx.font = '13px monospace';
    ctx.fillText('TRACKING QR CODE', canvas.width / 2, 54);

    // QR Image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 30, 80, 300, 300);

      // Invoice info
      ctx.fillStyle = '#1A1A1A';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(invoiceNumber, canvas.width / 2, 406);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#555555';
      ctx.fillText(customerName, canvas.width / 2, 426);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#888888';
      ctx.fillText('Scan to track service progress', canvas.width / 2, 448);

      const link = document.createElement('a');
      link.download = `QR_Label_${invoiceNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('QR Label downloaded!');
    };
    img.src = qrDataUrl;
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    toast.success('Tracking URL copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border-2 border-black shadow-[12px_12px_0_0_#000] p-6 w-full max-w-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FF6B9D] border-2 border-black flex items-center justify-center">
            <QrCode className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-black font-mono text-lg">QR CODE</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 border-2 border-black hover:bg-gray-100">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="bg-[#FFDE00] border-2 border-black p-3 mb-4">
        <p className="font-black font-mono text-sm">{invoiceNumber}</p>
        <p className="font-mono text-xs text-gray-700">{customerName}</p>
      </div>

      {/* QR Display */}
      <div className="flex items-center justify-center border-2 border-black p-4 bg-white mb-4 shadow-[4px_4px_0_0_#000]">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" />
        ) : (
          <div className="w-56 h-56 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-black border-t-[#FF6B9D]" />
          </div>
        )}
      </div>

      {/* Tracking URL */}
      <div className="border-2 border-black p-2 mb-4 flex items-center gap-2 bg-gray-50">
        <p className="font-mono text-[10px] flex-1 truncate text-gray-600">{trackingUrl}</p>
        <button
          onClick={copyUrl}
          className="p-1 border border-black bg-white hover:bg-[#FFDE00] transition-colors flex-shrink-0"
        >
          {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
        </button>
      </div>

      {/* Download Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={downloadQR}
          disabled={!qrDataUrl}
          className="flex items-center justify-center gap-2 py-2.5 bg-[#3B82F6] text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] font-mono font-bold text-xs transition-all disabled:opacity-50"
        >
          <Download size={14} />
          DOWNLOAD QR
        </button>
        <button
          onClick={downloadWithLabel}
          disabled={!qrDataUrl}
          className="flex items-center justify-center gap-2 py-2.5 bg-[#FFDE00] text-black border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] font-mono font-bold text-xs transition-all disabled:opacity-50"
        >
          <Download size={14} />
          WITH LABEL
        </button>
      </div>
    </motion.div>
  );
}
