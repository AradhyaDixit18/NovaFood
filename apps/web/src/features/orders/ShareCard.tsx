import { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

export interface ShareCardContent {
  eyebrow: string;
  title: string;
  lines: string[];
  footer: string;
  hue?: number;
}

/**
 * Draws a 1080×1350 story-style card on a canvas (no dependencies) and shares it with the
 * Web Share API, or downloads it where sharing files is not supported.
 */
function draw(canvas: HTMLCanvasElement, c: ShareCardContent) {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const hue = c.hue ?? 12;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `hsl(${hue} 95% 60%)`);
  g.addColorStop(1, '#6c2bd9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // confetti
  const colors = ['#c6f432', '#ff7ac6', '#ffc93c', '#fff7f0'];
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.globalAlpha = 0.5;
    ctx.save();
    ctx.translate((i * 197) % W, (i * 311) % 420);
    ctx.rotate(i);
    ctx.fillRect(-10, -4, 20, 8);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  const font = (weight: number, size: number) => `${weight} ${size}px "Bricolage Grotesque Variable", "Plus Jakarta Sans Variable", Arial, sans-serif`;
  ctx.fillStyle = '#fff7f0';
  ctx.font = font(800, 56);
  ctx.fillText('NovaFood', 80, 140);

  // sticker label
  ctx.fillStyle = '#c6f432';
  ctx.strokeStyle = '#1b0f3b';
  ctx.lineWidth = 6;
  ctx.font = font(800, 40);
  const labelW = ctx.measureText(c.eyebrow).width + 64;
  ctx.beginPath();
  ctx.roundRect(80, 420, labelW, 80, 40);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b0f3b';
  ctx.fillText(c.eyebrow, 112, 474);

  ctx.fillStyle = '#fff7f0';
  ctx.font = font(800, 104);
  const words = c.title.split(' ');
  let line = '';
  let y = 640;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 160) {
      ctx.fillText(line, 80, y);
      line = w;
      y += 112;
    } else line = test;
  }
  ctx.fillText(line, 80, y);

  ctx.font = font(600, 44);
  y += 100;
  for (const l of c.lines.slice(0, 5)) {
    ctx.fillText(l.length > 38 ? `${l.slice(0, 37)}…` : l, 80, y);
    y += 64;
  }

  ctx.font = font(600, 36);
  ctx.globalAlpha = 0.85;
  ctx.fillText(c.footer, 80, H - 100);
  ctx.globalAlpha = 1;
}

export function ShareCardButton({ content, label = 'Share' }: { content: ShareCardContent; label?: string }) {
  const [open, setOpen] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && canvas.current) void document.fonts?.ready.then(() => canvas.current && draw(canvas.current, content));
  }, [open, content]);

  const toBlob = () => new Promise<Blob | null>((resolve) => canvas.current?.toBlob(resolve, 'image/png'));

  const share = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], 'novafood.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: content.title, text: 'Ordered on NovaFood 😋' });
      } catch {
        /* user cancelled */
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'novafood.png';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Card downloaded 📸');
  };

  return (
    <>
      <Button variant="outline" leftIcon={<Share2 className="h-4 w-4" />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Share card"
        description="Post it to your story. Only what you see here is shared."
        footer={
          <div className="flex justify-end">
            <Button leftIcon={<Download className="h-4 w-4" />} onClick={share}>
              Share or download
            </Button>
          </div>
        }
      >
        <canvas ref={canvas} className="mx-auto aspect-[4/5] w-full max-w-sm rounded-lg shadow-lift" aria-label={`${content.eyebrow}: ${content.title}`} role="img" />
      </Modal>
    </>
  );
}
