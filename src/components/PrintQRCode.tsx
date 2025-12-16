import { QRCodeSVG } from 'qrcode.react';

interface PrintQRCodeProps {
  url: string;
  title?: string;
  size?: number;
}

export function PrintQRCode({ url, title, size = 100 }: PrintQRCodeProps) {
  // Reduce size by 25%
  const adjustedSize = Math.round(size * 0.75);
  
  return (
    <div className="hidden print:flex flex-row items-center gap-2 p-2 border border-gray-300 bg-white my-1">
      <QRCodeSVG 
        value={url} 
        size={adjustedSize}
        level="M"
        includeMargin={false}
      />
      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-semibold text-8pt break-all">
            {title}
          </p>
        )}
        <p className="text-7pt break-all text-gray-600">
          {url}
        </p>
      </div>
    </div>
  );
}
