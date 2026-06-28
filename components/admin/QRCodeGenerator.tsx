'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode, Download, X, Copy, Check,
  Share2, Send, MessageCircle, Printer
} from 'lucide-react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';

interface QRCodeGeneratorProps {
  invoiceNumber: string;
  token: string;
  customerName: string;
  customerPhone?: string;
  onClose?: () => void;
}

export default function QRCodeGenerator({
  invoiceNumber,
  token,
  customerName,
  customerPhone,
  onClose
}: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
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
          dark: '#115e59',
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
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    // Header
    ctx.fillStyle = '#115e59';
    ctx.fillRect(0, 0, canvas.width, 64);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WATCH SERVICE', canvas.width / 2, 30);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('TRACKING QR CODE', canvas.width / 2, 50);

    // QR Image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 30, 80, 300, 300);

      // Invoice info
ctx.fillStyle = '#0F766E';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillText(invoiceNumber, canvas.width / 2, 406);

      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = '#6C757D';
      ctx.fillText(customerName, canvas.width / 2, 428);

      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = '#ADB5BD';
      ctx.fillText('Scan to track service progress', canvas.width / 2, 450);

      const link = document.createElement('a');
      link.download = `QR_Label_${invoiceNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('QR Label downloaded!');
    };
    img.src = qrDataUrl;
  };

  const shareViaWhatsApp = async () => {
    if (!customerPhone) {
      toast.error('Nomor WhatsApp customer tidak tersedia');
      return;
    }

    setWhatsappLoading(true);

    try {
      // Format phone number
      let phone = customerPhone.replace(/\D/g, '');
      if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
      } else if (phone.startsWith('+')) {
        phone = phone.substring(1);
      }

      // Create message with QR and token
      const message = `*WATCH SERVICE - TRACKING INFORMATION*

Halo ${customerName},

Berikut adalah informasi tracking untuk service Anda:

📋 *Invoice:* ${invoiceNumber}
🔑 *Token:* ${token}
📱 *Link Tracking:* ${trackingUrl}

Scan QR Code di bawah atau klik link di atas untuk melihat progress service Anda.

Terima kasih telah menggunakan layanan kami. 🙏

---
*Watch Service Management*
`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;

      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');

      toast.success('WhatsApp dibuka! Kirim pesan ke customer.');
    } catch (error) {
      toast.error('Gagal membuka WhatsApp');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    toast.success('Tracking URL copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyMessage = () => {
    const message = `*WATCH SERVICE - TRACKING INFORMATION*

Halo ${customerName},

Berikut adalah informasi tracking untuk service Anda:

📋 *Invoice:* ${invoiceNumber}
🔑 *Token:* ${token}
📱 *Link Tracking:* ${trackingUrl}

Terima kasih telah menggunakan layanan kami. 🙏

---
*Watch Service Management*
`;
    navigator.clipboard.writeText(message);
    toast.success('Pesan copy! Bisa langsung paste ke WhatsApp.');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 w-full max-w-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <QrCode className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-semibold text-slate-900">QR & Tracking</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={16} className="text-slate-500" />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="bg-[#F8F9FA] rounded-lg p-3 mb-4 border border-slate-200">
        <p className="font-mono text-sm font-semibold text-slate-900">{invoiceNumber}</p>
        <p className="text-sm text-slate-500">{customerName}</p>
      </div>

      {/* QR Display */}
      <div className="flex items-center justify-center border border-slate-200 rounded-lg p-4 bg-white mb-4">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
        ) : (
          <div className="w-48 h-48 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border border-blue-600 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Token & URL */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Token:</span>
          <code className="flex-1 text-xs font-mono bg-[#F8F9FA] px-2 py-1 rounded border border-slate-200 truncate">
            {token}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(token);
              toast.success('Token copied!');
            }}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <Copy size={14} className="text-slate-500" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Link:</span>
          <code className="flex-1 text-xs font-mono bg-[#F8F9FA] px-2 py-1 rounded border border-slate-200 truncate">
            {trackingUrl}
          </code>
          <button
            onClick={copyUrl}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Share via WhatsApp */}
        {customerPhone && (
          <button
            onClick={shareViaWhatsApp}
            disabled={whatsappLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-medium text-sm disabled:opacity-50"
          >
            {whatsappLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <MessageCircle size={16} />
                Share via WhatsApp
              </>
            )}
          </button>
        )}

        {/* Copy Message */}
        <button
          onClick={copyMessage}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium text-sm"
        >
          <Share2 size={16} />
          Copy Tracking Message
        </button>

        {/* Download Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={downloadQR}
            disabled={!qrDataUrl}
            className="flex items-center justify-center gap-2 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all font-medium text-sm disabled:opacity-50"
          >
            <Download size={14} />
            QR Code
          </button>
          <button
            onClick={downloadWithLabel}
            disabled={!qrDataUrl}
            className="flex items-center justify-center gap-2 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all font-medium text-sm disabled:opacity-50"
          >
            <Printer size={14} />
            With Label
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-400 text-center">
          QR Code & Token untuk tracking service customer
        </p>
      </div>
    </motion.div>
  );
}
