import { useRef, useEffect, useCallback } from 'react';

export interface TamponConfig {
  nomDZ: string;
  numeroAgrement: string;
  couleurPrimaire: string;
  couleurTexte: string;
  logoUrl: string | null;
  dateValidation?: string;
  validateur?: string;
  rotation?: number; // deg
  opacity?: number;
}

const SIZE = 240;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = SIZE / 2 - 6;
const R_INNER = R_OUTER - 10;
const R_TEXT_TOP = R_OUTER - 14;
const R_TEXT_BOT = R_INNER + 10;
const R_LOGO = 44;

function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  totalArc: number,
  color: string,
  fontSize: number,
) {
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const chars = text.split('');
  const charAngle = totalArc / (chars.length - 1 || 1);
  chars.forEach((ch, i) => {
    const angle = startAngle + i * charAngle;
    ctx.save();
    ctx.translate(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

export function drawTampon(
  canvas: HTMLCanvasElement,
  config: TamponConfig,
  logo: HTMLImageElement | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = SIZE;
  canvas.height = SIZE;
  ctx.clearRect(0, 0, SIZE, SIZE);

  const { nomDZ, numeroAgrement, couleurPrimaire, couleurTexte, dateValidation } = config;

  // double ring
  ctx.strokeStyle = couleurPrimaire;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(CX, CY, R_OUTER, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CX, CY, R_INNER, 0, Math.PI * 2);
  ctx.stroke();

  // logo
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY - 10, R_LOGO, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, CX - R_LOGO, CY - R_LOGO - 10, R_LOGO * 2, R_LOGO * 2);
    ctx.restore();
  } else {
    // placeholder star
    ctx.fillStyle = couleurPrimaire;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', CX, CY - 10);
  }

  // numero agrement
  ctx.fillStyle = couleurPrimaire;
  ctx.font = `bold 11px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numeroAgrement, CX, CY + 42);

  // top arc text — DZ name
  const topText = nomDZ.toUpperCase();
  const topArc = Math.PI * 1.1;
  const topStart = -Math.PI / 2 - topArc / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  arcText(ctx, topText, CX, CY, R_TEXT_TOP, topStart, topArc, couleurPrimaire, 11);

  // bottom arc text
  const year = dateValidation ? new Date(dateValidation).getFullYear() : new Date().getFullYear();
  const bottomText = `★ VALIDÉ PARAPASS ★ ${year}`;
  const botArc = Math.PI * 1.05;
  const botStart = Math.PI / 2 - botArc / 2;
  ctx.textBaseline = 'alphabetic';
  arcText(ctx, bottomText, CX, CY, R_TEXT_BOT, botStart, botArc, couleurTexte === '#FFFFFF' ? couleurPrimaire : couleurTexte, 9);
}

interface TamponDZProps {
  config: TamponConfig;
  className?: string;
  /** if true renders with ink stamp effect */
  stampEffect?: boolean;
}

export function TamponDZ({ config, className = '', stampEffect = false }: TamponDZProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawTampon(canvas, config, logoRef.current);
  }, [config]);

  useEffect(() => {
    if (config.logoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { logoRef.current = img; render(); };
      img.onerror = () => { logoRef.current = null; render(); };
      img.src = config.logoUrl;
    } else {
      logoRef.current = null;
      render();
    }
  }, [config.logoUrl, render]);

  useEffect(() => { render(); }, [render]);

  const rotation = config.rotation ?? 0;
  const opacity = config.opacity ?? 1;

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className={className}
      style={{
        transform: `rotate(${rotation}deg)`,
        opacity,
        filter: stampEffect ? 'contrast(1.15) saturate(0.9)' : undefined,
        boxShadow: stampEffect ? '0 1px 6px rgba(0,0,0,0.12)' : undefined,
      }}
    />
  );
}

export function exportTamponPNG(
  config: TamponConfig,
  logoUrl: string | null,
  callback: (dataUrl: string) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  if (logoUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { drawTampon(canvas, config, img); callback(canvas.toDataURL('image/png')); };
    img.onerror = () => { drawTampon(canvas, config, null); callback(canvas.toDataURL('image/png')); };
    img.src = logoUrl;
  } else {
    drawTampon(canvas, config, null);
    callback(canvas.toDataURL('image/png'));
  }
}
