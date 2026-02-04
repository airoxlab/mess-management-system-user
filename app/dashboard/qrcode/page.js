'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

export default function QRCodePage() {
  const { memberData, memberType } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const qrRef = useRef(null);

  // Create QR code data
  const qrData = JSON.stringify({
    id: memberData?.id,
    type: memberType,
    membershipId: memberData?.membership_id,
    name: memberData?.full_name,
    email: memberData?.email_address,
  });

  const handleDownload = async () => {
    try {
      setDownloading(true);

      // Get the SVG element
      const svg = qrRef.current?.querySelector('svg');
      if (!svg) {
        toast.error('QR Code not found');
        return;
      }

      // Create a canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();

      // Set canvas size with padding
      const padding = 40;
      canvas.width = 256 + padding * 2;
      canvas.height = 256 + padding * 2;

      // Create image from SVG
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw QR code centered
        ctx.drawImage(img, padding, padding, 256, 256);

        // Add text below
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(memberData?.full_name || '', canvas.width / 2, canvas.height - 15);

        // Download
        const link = document.createElement('a');
        link.download = `qrcode-${memberData?.membership_id || 'member'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        URL.revokeObjectURL(url);
        toast.success('QR Code downloaded!');
        setDownloading(false);
      };

      img.src = url;
    } catch (error) {
      console.error('Error downloading QR code:', error);
      toast.error('Failed to download QR code');
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">My QR Code</h1>
        <p className="text-gray-600 mt-1">
          Show this QR code at the cafeteria for meal verification
        </p>
      </div>

      {/* QR Code Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="flex flex-col items-center">
          {/* QR Code */}
          <div
            ref={qrRef}
            className="bg-white p-6 rounded-xl shadow-inner border-2 border-gray-100"
          >
            <QRCodeSVG
              value={qrData}
              size={256}
              level="H"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#1f2937"
            />
          </div>

          {/* Member Info */}
          <div className="mt-6 text-center">
            <h2 className="text-xl font-bold text-gray-900">
              {memberData?.full_name}
            </h2>
            <p className="text-gray-600 mt-1 capitalize">{memberType}</p>
            {memberData?.membership_id && (
              <p className="text-sm text-gray-500 mt-2">
                ID: {memberData.membership_id}
              </p>
            )}
          </div>

          {/* Download Button */}
          <Button
            onClick={handleDownload}
            loading={downloading}
            className="mt-6"
            size="lg"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download QR Code
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3">How to use</h3>
        <ol className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">
              1
            </span>
            <span>Go to the cafeteria during meal time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">
              2
            </span>
            <span>Show this QR code to the staff</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">
              3
            </span>
            <span>Staff will scan your code to verify your meal eligibility</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">
              4
            </span>
            <span>Enjoy your meal!</span>
          </li>
        </ol>
      </div>

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 className="font-semibold text-amber-900">Important</h4>
            <p className="text-sm text-amber-800 mt-1">
              Make sure you have selected your meals for today in the sidebar or on the
              Meal Selection page. Only meals you have marked as &quot;needed&quot; will be
              available when you scan your QR code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
