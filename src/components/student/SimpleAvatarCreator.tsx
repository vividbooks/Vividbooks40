import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface AvatarConfig {
  backgroundColor: string;
  skinTone: string;
  faceShape: string;
  eyeStyle: string;
  mouthStyle: string;
  hairStyle: string;
  hairColor: string;
}

interface SimpleAvatarCreatorProps {
  initialAvatar?: AvatarConfig;
  onSave?: (avatar: AvatarConfig) => void;
  onCancel?: () => void;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  backgroundColor: '#E8485F',
  skinTone: '#FFDCDC',
  faceShape: 'round',
  eyeStyle: 'dots',
  mouthStyle: 'smile',
  hairStyle: 'short',
  hairColor: '#8B5A2B'
};

export default function SimpleAvatarCreator({ initialAvatar, onSave, onCancel }: SimpleAvatarCreatorProps) {
  const [avatar, setAvatar] = useState<AvatarConfig>(initialAvatar || DEFAULT_AVATAR);

  const [openPicker, setOpenPicker] = useState<string | null>(null);

  const backgroundColors = [
    '#E8485F', '#FF6B8A', '#FF8FA3', '#FFB3C1',
    '#4BA3CC', '#6BCBFF', '#7DD3FC', '#A5E8FF',
    '#D4B83D', '#FFE156', '#FFF06B', '#FFFBA3',
    '#5DBD6E', '#7EE890', '#98E8A0', '#B8F5BC',
    '#9B6BC9', '#B88DE8', '#C9A0FF', '#DFC2FF',
    '#E08A3E', '#FF9F4A', '#FFB366', '#FFCF99',
    '#FF4D6D', '#C9184A', '#590D22', '#2D0012',
    '#00F5D4', '#00BBF9', '#9B5DE5', '#F15BB5',
    '#FEE440', '#8AC926', '#1982C4', '#FF595E'
  ];
  
  const skinTones = [
    '#FFEBEB', '#FFDCDC', '#FFD5D5', '#FFC8C8',
    '#FFE4D6', '#FFDBC8', '#F5D0C5', '#EECAB8',
    '#E8C4A8', '#D4A574', '#C99A65', '#BE8A52',
    '#C68642', '#B47535', '#A36428', '#8D5524',
    '#7A4820', '#6B3D1A', '#5C3317', '#4A2912',
    '#FFB4A2', '#E5989B', '#B5838D', '#6D6875',
    '#98F5E1', '#B8E0D2', '#D6EADF', '#EAF2E3',
    '#CAFFBF', '#9BF6FF', '#A0C4FF', '#FFC6FF'
  ];
  
  const hairColors = [
    '#0A0A0A', '#1A1A1A', '#2D2D2D', '#404040',
    '#4A3728', '#5C4033', '#6B4423', '#7A4E1A',
    '#8B5A2B', '#A0522D', '#B5651D', '#CD853F',
    '#D4A574', '#DEB887', '#E8C89E', '#F5DEB3',
    '#FF6B6B', '#FF4757', '#EE5A5A', '#C0392B',
    '#FF69B4', '#FF1493', '#DB7093', '#C71585',
    '#FFD700', '#FFC200', '#FFB000', '#FF9500',
    '#6BCBFF', '#00D4FF', '#00BFFF', '#1E90FF',
    '#98E8A0', '#00FF7F', '#32CD32', '#228B22',
    '#C9A0FF', '#9B59B6', '#8E44AD', '#6B2D91',
    '#FFFFFF', '#E8E8E8', '#C0C0C0', '#A0A0A0'
  ];

  const updateAvatar = (key: keyof AvatarConfig, value: string) => setAvatar(prev => ({ ...prev, [key]: value }));

  const renderFace = () => {
    const shapes: Record<string, React.JSX.Element> = {
      round: <circle cx="100" cy="105" r="63" fill={avatar.skinTone} />,
      square: <rect x="37" y="42" width="126" height="126" rx="15" ry="15" fill={avatar.skinTone} />,
      triangle: <path d="M108.2,161.16l61.12-105.88c3.84-6.66-.96-14.96-8.64-14.96H38.42c-7.68,0-12.46,8.3-8.62,14.94l61.12,105.88c3.84,6.66,13.44,6.66,17.28,0Z" fill={avatar.skinTone} transform="translate(100, 95) scale(1.2) translate(-100, -95)" />
    };
    return shapes[avatar.faceShape];
  };

  const renderEyes = () => {
    const styles: Record<string, React.JSX.Element> = {
      dots: (
        <>
          <circle cx="78.86" cy="111.32" r="10.44" fill="#000" />
          <circle cx="119.06" cy="111" r="10.44" fill="#000" />
          <path d="M80.46,81.28s-4.44,9.74-18.02,12.24" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M118.68,81.28s4.44,9.74,18.02,12.24" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      ),
      big: (
        <>
          <circle cx="82.64" cy="107.16" r="13.8" fill="#000" />
          <circle cx="120.98" cy="107.16" r="13.8" fill="#000" />
          <path d="M65.22,87.74s6.68-8.36,20.46-7.48" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M134.78,82.08s-8.84-6.02-21.76-1.1" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      ),
      spiral: (
        <>
          <circle cx="79.06" cy="102.9" r="18.1" fill="#fff" />
          <path d="M87.58,111.06c-6.5,5.68-15.02,3.9-19.08-2.7-3.52-5.72-1.62-13.22,4.14-16.68,4.6-2.78,10.58-1.3,13.34,3.3,2.22,3.68,1.04,8.46-2.64,10.68-2.94,1.78-6.76.82-8.54-2.12-1.42-2.36-.66-5.42,1.7-6.84" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="120.94" cy="103.62" r="18.1" fill="#fff" />
          <path d="M129.44,111.78c-6.5,5.68-15.02,3.9-19.08-2.7-3.52-5.72-1.62-13.22,4.14-16.68,4.6-2.78,10.58-1.3,13.34,3.3,2.22,3.68,1.04,8.46-2.64,10.68-2.94,1.78-6.76.82-8.54-2.12-1.42-2.36-.66-5.42,1.7-6.84" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="4" />
          <path d="M82.32,70.82s-3.58,7.86-14.52,9.88" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M113.12,70.82s3.58,7.86,14.52,9.88" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      ),
      sunglasses: (
        <path d="M140.62,76.24c-13.14,3.28-27.62.82-40.48,6.7-11.04-4.28-23.12-5.16-34.78-5.2-6.22-2.02-13.58-3.32-14.46,6.06-.9,3.84,6.94,15.4,8.18,18.82,2.7,5.24,7.52,8.42,12.68,8.38,22.72,3.72,23.36-16.9,33.26-7.82,4,5,9.56,7.82,15.36,7.86,7.84.36,16.82.3,20.78-8.44,3.92-7.18,16.14-26.78-.58-26.36Z" fill="#000" />
      ),
      squareGlasses: (
        <>
          <rect x="47.34" y="72.9" width="47.4" height="36.9" rx="5.48" ry="5.48" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <rect x="105.28" y="72.9" width="47.4" height="36.9" rx="5.48" ry="5.48" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <path d="M94.72,91.36c0-3.26,2.36-5.9,5.28-5.9s5.28,2.64,5.28,5.9" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="73.88" cy="90.88" r="5.78" fill="#211c16" />
          <circle cx="125.84" cy="91.36" r="5.78" fill="#211c16" />
        </>
      ),
      roundGlasses: (
        <>
          <circle cx="78.48" cy="93.68" r="20.86" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="121.52" cy="93.68" r="20.86" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="76.46" cy="99.64" r="5.78" fill="#211c16" />
          <circle cx="119.44" cy="99.64" r="5.78" fill="#211c16" />
        </>
      ),
      squiggle: (
        <>
          <path d="M87.28,97.5c1.88-2.8,12.02-6.28,13.04-2.16,1.3,5.24-13.28,1.42-9.28,9.88.6,1.26,8.12,4.74,3.44,7.06-5.28,2.6-10.9-9.02-7.86-13.44-8.98,1.4-1.06-8.74-7.24-12.76-3.16-2.04-6.18-.58-8.48,1.94-1.82,1.98-2.92,7.56-6.28,4.96-3-2.32,3.76-9.66,6.06-11.08,11-6.82,18.88,5.32,16.62,15.62Z" fill="#211c16" />
          <path d="M120.52,88.48c9.6-1.98,15.98,6.18,14.54,15.2-.44,2.78-3.5,4.4-4.9,2.38-1.54-2.2,2.02-11.4-5.5-12.9-6.98-1.38-7.74,8.28-10.84,8.28-6.24.02,1.14-11.82,6.7-12.98Z" fill="#211c16" />
        </>
      ),
      wink: (
        <>
          <path d="M131.08,102.96s-6.48-20.32-24.7-6.54" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
          <path d="M92.88,95.16s-17-12.88-23.96,8.86" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
        </>
      ),
      happy: (
        <>
          <path d="M69.58,93.68s11.48,17.98,25.54,0" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
          <path d="M104.86,93.68s11.48,17.98,25.54,0" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
        </>
      ),
      anime: (
        <>
          <path d="M64.72,95.38c0-10.72,7.34-19.4,16.4-19.4s16.4,8.68,16.4,19.4" fill="#fff" />
          <path d="M71.92,95.38c0-5.56,4.12-10.08,9.2-10.08s9.2,4.5,9.2,10.08" fill="#1c1468" />
          <path d="M102.48,95.38c0-10.72,7.34-19.4,16.4-19.4s16.4,8.68,16.4,19.4" fill="#fff" />
          <path d="M109.7,95.38c0-5.56,4.12-10.08,9.2-10.08s9.2,4.5,9.2,10.08" fill="#1c1468" />
          <path d="M88.82,114.78c-5.52-8.1-.44-17.12,8.42-19.28,2.72-.66,5.4,1.54,4.08,3.62-1.44,2.26-11.3,2.54-9.78,10.06,1.42,6.98,10.62,3.96,11.82,6.8,2.42,5.74-11.36,3.5-14.56-1.18Z" fill="#211c16" />
        </>
      ),
      cute: (
        <>
          <ellipse cx="78.7" cy="88.6" rx="14.22" ry="16.82" fill="#fff" />
          <ellipse cx="74.98" cy="87.52" rx="7.98" ry="8.74" fill="#1c1468" />
          <ellipse cx="116.42" cy="88.6" rx="14.22" ry="16.82" fill="#fff" />
          <ellipse cx="112.7" cy="87.52" rx="7.98" ry="8.74" fill="#1c1468" />
          <path d="M81,117.92c-5.52-8.1-.44-17.12,8.42-19.28,2.72-.66,5.4,1.54,4.08,3.62-1.44,2.26-11.3,2.54-9.78,10.06,1.42,6.98,10.62,3.96,11.82,6.8,2.42,5.74-11.36,3.5-14.56-1.18Z" fill="#211c16" />
        </>
      ),
      grumpy: (
        <>
          <circle cx="84.1" cy="108.68" r="11" fill="#000" />
          <circle cx="121.36" cy="104.24" r="11" fill="#000" />
          <path d="M81.22,88s-4.66,10.24-18.96,12.88" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M125.96,82.08s4.66,10.24,18.96,12.88" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      )
    };
    return styles[avatar.eyeStyle];
  };

  const renderMouth = () => {
    const styles: Record<string, React.JSX.Element> = {
      smile: (
        <path d="M77.06,122.2c1.84-1.16,8.44,1.44,10.84,1.8,7.56,1.16,13.64.42,21.14-.72,2.92-.44,9.92-2.74,12.02-2.6,3.7.26,1.02,9.44,0,11.82-7.94,18.5-35.78,19.04-43.3.26-.82-2.06-2.66-9.34-.68-10.58Z" fill="#211c16" />
      ),
      happy: (
        <path d="M77.04,133.82s19.54,20.38,45.92-.16" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6" />
      ),
      smoking: (
        <>
          <path d="M105.46,127.62s17.26,9.42-.22,13.22c0,0,15.18,12.14-2.84,13.66" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
          <path d="M107.64,141.74c13.54,1.98,34.02,4.94,47.56,6.92,13.54,1.98,14.4-15.58,3.06-17.22-8.84-1.28-11.14,8.6-1.74,9.96" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
        </>
      ),
      surprised: (
        <path d="M120.96,147.08c-1.94.98-8.28-2.18-10.64-2.76-7.42-1.82-13.56-1.62-21.12-1.18-2.94.18-10.12,1.86-12.2,1.52-3.66-.6-.16-9.5,1.06-11.78,9.56-17.72,37.34-15.78,43.16,3.6.64,2.12,1.82,9.54-.26,10.6Z" fill="#211c16" />
      ),
      neutral: (
        <path d="M86.4,122.66s11.58-4.52,27.2.04" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6" />
      ),
      sad: (
        <path d="M78.64,124.56s19.54-13.3,45.92.1" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6" />
      ),
      teeth: (
        <g transform="translate(100, 130) scale(2) translate(-50, -70)">
          <path d="M29.6,63.01c1.66-.78,7.57.97,9.72,1.22,6.78.78,12.23.28,18.96-.49,2.62-.3,8.89-1.86,10.77-1.75,3.32.18.91,6.39,0,7.99-7.13,12.51-32.09,12.87-38.83.17-.74-1.39-2.39-6.31-.62-7.14Z" fill="#211c16" />
          <path d="M47.14,66.23h0c1.37,0,2.47,1.11,2.47,2.47v2.6c0,.53-.43.96-.96.96h-3.02c-.53,0-.96-.43-.96-.96v-2.6c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(-175.68 47.14 68.26)" />
          <path d="M53.22,66.31h0c1.37,0,2.47,1.11,2.47,2.47v2.6c0,.53-.43.96-.96.96h-3.02c-.53,0-.96-.43-.96-.96v-2.6c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(177.14 53.22 68.34)" />
        </g>
      ),
      wavy: (
        <g transform="translate(100, 130) scale(2) translate(-50, -65)">
          <path d="M32.28,68.33c1.33-3.53,4.75-10.08,8.11-4.58s4.3,9.14,7.08.68,6.6.32,8.25,3.01c2.02,3.3,4.49,2.34,8.83-5.37" fill="none" stroke="#211c16" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2" />
        </g>
      ),
      goofy: (
        <g transform="translate(100, 125) scale(2) translate(-50, -70)">
          <path d="M46.29,71.4h0c1.37,0,2.47,1.11,2.47,2.47v3.56h-4.95v-3.56c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(-165.02 46.29 73.67)" />
          <path d="M52.01,71.95h0c1.37,0,2.47,1.11,2.47,2.47v3.56h-4.95v-3.56c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(177.14 52.01 74.2)" />
          <path d="M43.68,70s16.91,7.33,26.26-10.48" fill="none" stroke="#211c16" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2" />
        </g>
      ),
      kiss: (
        <g transform="translate(100, 130) scale(2) translate(-50, -70)">
          <path d="M54.01,73.79c-3.99,2.85-8.55.41-9.73-4-.36-1.36.71-2.72,1.76-2.08,1.15.69,1.39,5.62,5.13,4.77,3.47-.78,1.86-5.35,3.27-5.98,2.84-1.27,1.88,5.64-.43,7.29Z" fill="#211c16" />
        </g>
      )
    };
    return styles[avatar.mouthStyle];
  };

  const renderHair = () => {
    const styles: Record<string, React.JSX.Element | null> = {
      none: null,
      short: (
        <path d="M136.28,92.54c-.88-3.08-5-25.1-6.1-25.86-2.08-1.44-5.38,3.82-7.42,5.22-13.68,9.34-30.14.2-39.52-10.66-1.02-1.2-1.6-3.76-3.44-3.7-1.96.06-2.52,2.2-3.66,3.46-7.58,8.2-16.62,15.7-27.06,19.86-4.14,1.64-8.64,2.42-12.86,3.86-4.8-12.46-3.12-26.4,4.3-37.52,16.72-25.04,56.9-29.38,81.7-14.8,2.08,1.22,4.52,3.98,6.8,4.82,2.82,1.02,7.44-.2,10.9.7,16.4,4.26,27.24,21.22,27.24,37.7,0,2.66-2.02,15.16-3.56,16.64-1.2,1.16-5.04-2.14-6.84-2.84-7.04-2.72-14.34-.94-20.46,3.18Z" fill={avatar.hairColor} />
      ),
      pigtails: (
        <>
          <path d="M149.9,78.36c-.88-3.08-13.94-25.1-15.02-25.86-2.08-1.44-5.38,3.82-7.42,5.22-13.68,9.34-30.14.2-39.52-10.66-1.02-1.2-1.6-3.76-3.44-3.7-1.96.06-2.52,2.2-3.66,3.46-7.58,8.2-16.62,15.7-27.06,19.86-4.14,1.64-8.64,2.42-12.86,3.86-4.8-12.46-3.12-26.4,4.3-37.52C61.94,7.94,102.1,3.6,126.9,18.16c2.08,1.22,4.52,3.98,6.8,4.82,2.82,1.02,7.44-.2,10.9.7,16.4,4.26,27.24,21.22,27.24,37.7,0,2.66-2.02,15.16-3.56,16.64-1.2,1.16-5.04-2.14-6.84-2.84-7.04-2.72-5.42-.94-11.54,3.18Z" fill={avatar.hairColor} />
          <path d="M48.06,65.86h12.96v12.96c0,29.7-24.12,53.82-53.82,53.82h-12.96v-12.96c0-29.7,24.12-53.82,53.82-53.82Z" transform="translate(-38.8 20.5) rotate(-24.59)" fill={avatar.hairColor} />
          <path d="M192.26,65.86h12.96v12.96c0,29.7-24.12,53.82-53.82,53.82h-12.96v-12.96c0-29.7,24.12-53.82,53.82-53.82Z" transform="translate(6.3 208.68) rotate(-63.48)" fill={avatar.hairColor} />
        </>
      ),
      curly: (
        <path d="M171.86,129.26c6.58-4.14,9.86-13.44,3.44-21.7-1.12-1.44-4.2-3.3-4.1-4.76.1-1.52,2.8-3.38,3.78-4.8,3.8-5.5,2.46-15.22-1.26-20.5-1.62-2.3-3.54-4-5.64-5.32,10.6-12.16,10.7-30.6-.38-42.9-11.98-13.28-32.44-14.34-45.72-2.36-2.06,1.86-3.78,3.92-5.24,6.14-.14-.28-.26-.52-.4-.72-7.36-11-22.28-15.32-32.56-5.64-.86.8-1.72,2.44-2.52,3.54-5.82-7-14.6-11.46-24.42-11.46-17.54,0-31.74,14.22-31.74,31.74s14.22,31.74,31.74,31.74c10.76,0,20.26-5.38,26-13.56,3.08,11.54,10.4,18.32,23.12,17.42,2.6-.18,10.56-3.12,11.04-2.82,1.42.84.92,3.76,1.28,5.22,2.96,12.08,10.86,17.26,22.9,14.58,3.38-.76,6.44-4.28,6,2.14-.46,6.44-1.34,10.56,2.56,16.66,2.18,3.42,4.62,5.8,7.12,7.32-3.24,2.32-5.36,6.12-5.36,10.42,0,4.98,2.84,9.3,7,11.42-1.48,1.5-2.42,3.56-2.42,5.82,0,4.56,3.68,8.24,8.24,8.24s8.24-3.68,8.24-8.24c0-2.28-.92-4.34-2.42-5.82,4.16-2.12,7-6.44,7-11.42,0-4.28-2.1-8.06-5.32-10.38Z" fill={avatar.hairColor} />
      ),
      spiky: (
        <path d="M171.72,18.54c-7.24,0-13.12,5.88-13.12,13.12,0,.52.04,1.02.1,1.52-2.4-.98-5.04-1.52-7.8-1.52-8.88,0-16.44,5.56-19.44,13.4-7.58-3.74-16.12-5.84-25.14-5.84h-14.48c-11.2,0-21.62,3.24-30.42,8.82-2.04-9.36-10.36-16.36-20.34-16.36-1.56,0-3.08.18-4.56.52,0-.18.02-.34.02-.52,0-7.24-5.88-13.12-13.12-13.12s-13.12,5.88-13.12,13.12c0,6.7,5.02,12.2,11.48,13.02-.98,2.42-1.52,5.04-1.52,7.82,0,11.04,8.6,20.04,19.44,20.76-3.1,7.02-4.82,14.78-4.82,22.94,0,0,27.6-3.66,44.78-44.48,0,0,46.86,46.84,83.62,46.84v-2.34c0-8.62-1.92-16.78-5.36-24.1,8.04-2.88,13.8-10.56,13.8-19.58,0-2.76-.54-5.38-1.52-7.8.5.06,1,.1,1.52.1,7.24,0,13.12-5.88,13.12-13.12s-5.88-13.12-13.12-13.12Z" fill={avatar.hairColor} />
      ),
      side: (
        <path d="M183.86,104.66c-16.9-54.18-1.82-50.12-28.86-68.48-14.58-9.9-26.08-11.02-35.74-8.7-24.88-10.98-60.58-5.6-76.12,17.64-7.42,11.12-9.08,25.06-4.3,37.52,4.22-1.42,8.72-2.2,12.86-3.86,10.44-4.16,19.48-11.66,27.06-19.86,1.16-1.24,1.7-3.38,3.66-3.46,1.84-.06,2.42,2.5,3.44,3.7,9.38,10.86,25.84,20,39.52,10.66.5-.34,1.08-.92,1.72-1.58,3.2,6.92,7.46,13.96,11.48,20.98.12.56.24.98.32,1.26.1-.06.2-.12.3-.18,10.2,17.84,18.42,35.46,2.92,50.64-.26.26-.5.5-.76.76-14.3,14.42,5.24,36.82,21.58,24.74,15.06-11.14,30.56-30.78,20.9-61.78Z" fill={avatar.hairColor} />
      ),
      messy: (
        <path d="M161.22,66.54c-4-20.14-27.5-19.76-27.5-19.76-.44-3.72,10.64-10.76,10.64-10.76-12.42-5.86-27.28-.2-27.28-.2.66-26.8-35.04-29.74-35.04-29.74,10.86,9.58,4.88,28.16,4.88,28.16-4.44-10.18-24.4-8.22-24.4-8.22,7.76,2.34,8.88,11.94,8.88,11.94-32.16,2.16-32.6,22.7-32.6,22.7,16.42-2.16,26.4,9,26.4,9-16.42,2.16-15.96,16.04-15.96,16.04,6.78-.88,12.68.26,17.1,1.78,9.02,3.1,18.54,4.5,28.08,4.7l14.34.32c13.42.3,26.74-2.16,39.18-7.18h0s-5.98-5.86-5.98-5.86c9.32-1.56,19.3-12.92,19.3-12.92Z" fill={avatar.hairColor} />
      ),
      wavy: (
        <path d="M159.96,40.44c-1.8-.14-5.26.9-6.28-.14-1.06-1.1-.64-4.34-1.04-6.04-1.54-6.5-9.66-12.02-16.08-12.78-8.74-1.06-15.12,3.84-21.36,9.12-2.64-3.14-3.44-5.88-6.94-8.46-9.92-7.36-23.92-4.9-30.92,5.1-1.24,1.78-4.4,9.34-5.28,9.48-.4.06-5.46-2.56-7.46-2.86-13.08-1.9-26.3,6.3-26,20.4.04,1.74,1.44,4.72.98,5.82-.98,2.4-4.64,1.66-6.9,2.34-12.12,3.58-17.24,22.74-9.7,32.7.08.1.24.28.5.54,10.92,10.88,29.1,8.9,37.66-3.9l6.38-9.54c11.24,6.4,21.82,5.96,30.08-4.62,1.6-2.06,4.76-9.92,5.3-10.1,1.58-.5,3.4,1.84,4.74,2.54,10.96,5.9,20.1,3.48,26.16-7.24,1.7-3.02,1.14-7.64,5.6-3.02,4.48,4.64,6.96,8.08,14.08,9.26,25.48,4.2,26.74-27.12,6.46-28.58Z" fill={avatar.hairColor} />
      ),
      buzz: (
        <path d="M35.36,85.58s27.6-3.66,44.78-44.48c0,0,46.86,46.84,83.62,46.84v-48.8c0-5.8-4.7-10.52-10.52-10.52H45.88c-5.8,0-10.52,4.7-10.52,10.52v46.46Z" fill={avatar.hairColor} />
      ),
      bald: null
    };
    return styles[avatar.hairStyle];
  };

  const ColorCircle = ({ color, onClick, label, isOpen }: { color: string; onClick: () => void; label: string; isOpen: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <button
        onClick={onClick}
        style={{ 
          backgroundColor: color,
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          border: isOpen ? '4px solid #1f2937' : '4px solid white',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          cursor: 'pointer',
          transform: isOpen ? 'scale(1.1)' : 'scale(1)',
          transition: 'all 0.2s',
        }}
      />
      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );

  const ColorPopup = ({ colors, value, onChange, onClose }: { colors: string[]; value: string; onChange: (v: string) => void; onClose: () => void }) => (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: '16px',
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      padding: '16px',
      zIndex: 50,
      width: '288px',
    }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(8, 1fr)', 
        gap: '8px' 
      }}>
        {colors.map(color => (
          <button
            key={color}
            onClick={() => { onChange(color); onClose(); }}
            style={{ 
              backgroundColor: color,
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: value === color ? '2px solid #1f2937' : 'none',
              outline: value === color ? '2px solid white' : 'none',
              outlineOffset: value === color ? '2px' : '0',
              cursor: 'pointer',
              transform: value === color ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  );

  const FacePreview = ({ shape, size = 40 }: { shape: string; size?: number }) => {
    const shapes: Record<string, React.JSX.Element> = {
      round: <circle cx="100" cy="105" r="63" fill="#FFDCDC" />,
      square: <rect x="37" y="42" width="126" height="126" rx="15" ry="15" fill="#FFDCDC" />,
      triangle: <path d="M108.2,161.16l61.12-105.88c3.84-6.66-.96-14.96-8.64-14.96H38.42c-7.68,0-12.46,8.3-8.62,14.94l61.12,105.88c3.84,6.66,13.44,6.66,17.28,0Z" fill="#FFDCDC" transform="translate(100, 95) scale(1.2) translate(-100, -95)" />
    };
    return <svg viewBox="0 0 200 200" width={size} height={size}>{shapes[shape]}</svg>;
  };

  const EyePreview = ({ style, size = 40 }: { style: string; size?: number }) => {
    const styles: Record<string, React.JSX.Element> = {
      dots: (
        <>
          <circle cx="78.86" cy="111.32" r="10.44" fill="#000" />
          <circle cx="119.06" cy="111" r="10.44" fill="#000" />
          <path d="M80.46,81.28s-4.44,9.74-18.02,12.24" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M118.68,81.28s4.44,9.74,18.02,12.24" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      ),
      big: (
        <>
          <circle cx="82.64" cy="107.16" r="13.8" fill="#000" />
          <circle cx="120.98" cy="107.16" r="13.8" fill="#000" />
          <path d="M65.22,87.74s6.68-8.36,20.46-7.48" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M134.78,82.08s-8.84-6.02-21.76-1.1" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      ),
      spiral: (
        <>
          <circle cx="79.06" cy="102.9" r="18.1" fill="#fff" />
          <path d="M87.58,111.06c-6.5,5.68-15.02,3.9-19.08-2.7-3.52-5.72-1.62-13.22,4.14-16.68,4.6-2.78,10.58-1.3,13.34,3.3,2.22,3.68,1.04,8.46-2.64,10.68-2.94,1.78-6.76.82-8.54-2.12-1.42-2.36-.66-5.42,1.7-6.84" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="120.94" cy="103.62" r="18.1" fill="#fff" />
          <path d="M129.44,111.78c-6.5,5.68-15.02,3.9-19.08-2.7-3.52-5.72-1.62-13.22,4.14-16.68,4.6-2.78,10.58-1.3,13.34,3.3,2.22,3.68,1.04,8.46-2.64,10.68-2.94,1.78-6.76.82-8.54-2.12-1.42-2.36-.66-5.42,1.7-6.84" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="4" />
          <path d="M82.32,70.82s-3.58,7.86-14.52,9.88" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M113.12,70.82s3.58,7.86,14.52,9.88" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      ),
      sunglasses: (
        <path d="M140.62,76.24c-13.14,3.28-27.62.82-40.48,6.7-11.04-4.28-23.12-5.16-34.78-5.2-6.22-2.02-13.58-3.32-14.46,6.06-.9,3.84,6.94,15.4,8.18,18.82,2.7,5.24,7.52,8.42,12.68,8.38,22.72,3.72,23.36-16.9,33.26-7.82,4,5,9.56,7.82,15.36,7.86,7.84.36,16.82.3,20.78-8.44,3.92-7.18,16.14-26.78-.58-26.36Z" fill="#000" />
      ),
      squareGlasses: (
        <>
          <rect x="47.34" y="72.9" width="47.4" height="36.9" rx="5.48" ry="5.48" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <rect x="105.28" y="72.9" width="47.4" height="36.9" rx="5.48" ry="5.48" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <path d="M94.72,91.36c0-3.26,2.36-5.9,5.28-5.9s5.28,2.64,5.28,5.9" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="73.88" cy="90.88" r="5.78" fill="#211c16" />
          <circle cx="125.84" cy="91.36" r="5.78" fill="#211c16" />
        </>
      ),
      roundGlasses: (
        <>
          <circle cx="78.48" cy="93.68" r="20.86" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="121.52" cy="93.68" r="20.86" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="76.46" cy="99.64" r="5.78" fill="#211c16" />
          <circle cx="119.44" cy="99.64" r="5.78" fill="#211c16" />
        </>
      ),
      squiggle: (
        <>
          <path d="M87.28,97.5c1.88-2.8,12.02-6.28,13.04-2.16,1.3,5.24-13.28,1.42-9.28,9.88.6,1.26,8.12,4.74,3.44,7.06-5.28,2.6-10.9-9.02-7.86-13.44-8.98,1.4-1.06-8.74-7.24-12.76-3.16-2.04-6.18-.58-8.48,1.94-1.82,1.98-2.92,7.56-6.28,4.96-3-2.32,3.76-9.66,6.06-11.08,11-6.82,18.88,5.32,16.62,15.62Z" fill="#211c16" />
          <path d="M120.52,88.48c9.6-1.98,15.98,6.18,14.54,15.2-.44,2.78-3.5,4.4-4.9,2.38-1.54-2.2,2.02-11.4-5.5-12.9-6.98-1.38-7.74,8.28-10.84,8.28-6.24.02,1.14-11.82,6.7-12.98Z" fill="#211c16" />
        </>
      ),
      wink: (
        <>
          <path d="M131.08,102.96s-6.48-20.32-24.7-6.54" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
          <path d="M92.88,95.16s-17-12.88-23.96,8.86" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
        </>
      ),
      happy: (
        <>
          <path d="M69.58,93.68s11.48,17.98,25.54,0" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
          <path d="M104.86,93.68s11.48,17.98,25.54,0" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
        </>
      ),
      anime: (
        <>
          <path d="M64.72,95.38c0-10.72,7.34-19.4,16.4-19.4s16.4,8.68,16.4,19.4" fill="#fff" />
          <path d="M71.92,95.38c0-5.56,4.12-10.08,9.2-10.08s9.2,4.5,9.2,10.08" fill="#1c1468" />
          <path d="M102.48,95.38c0-10.72,7.34-19.4,16.4-19.4s16.4,8.68,16.4,19.4" fill="#fff" />
          <path d="M109.7,95.38c0-5.56,4.12-10.08,9.2-10.08s9.2,4.5,9.2,10.08" fill="#1c1468" />
          <path d="M88.82,114.78c-5.52-8.1-.44-17.12,8.42-19.28,2.72-.66,5.4,1.54,4.08,3.62-1.44,2.26-11.3,2.54-9.78,10.06,1.42,6.98,10.62,3.96,11.82,6.8,2.42,5.74-11.36,3.5-14.56-1.18Z" fill="#211c16" />
        </>
      ),
      cute: (
        <>
          <ellipse cx="78.7" cy="88.6" rx="14.22" ry="16.82" fill="#fff" />
          <ellipse cx="74.98" cy="87.52" rx="7.98" ry="8.74" fill="#1c1468" />
          <ellipse cx="116.42" cy="88.6" rx="14.22" ry="16.82" fill="#fff" />
          <ellipse cx="112.7" cy="87.52" rx="7.98" ry="8.74" fill="#1c1468" />
          <path d="M81,117.92c-5.52-8.1-.44-17.12,8.42-19.28,2.72-.66,5.4,1.54,4.08,3.62-1.44,2.26-11.3,2.54-9.78,10.06,1.42,6.98,10.62,3.96,11.82,6.8,2.42,5.74-11.36,3.5-14.56-1.18Z" fill="#211c16" />
        </>
      ),
      grumpy: (
        <>
          <path d="M66.04,84.54s12.66,9.66,26.5-.22" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M107.46,84.54s12.66,9.66,26.5-.22" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <circle cx="84.1" cy="108.68" r="11" fill="#000" />
          <circle cx="121.36" cy="104.24" r="11" fill="#000" />
        </>
      )
    };
    return <svg viewBox="0 0 200 200" width={size} height={size}>{styles[style]}</svg>;
  };

  const MouthPreview = ({ style, size = 40 }: { style: string; size?: number }) => {
    const styles: Record<string, React.JSX.Element> = {
      smile: (
        <path d="M77.06,122.2c1.84-1.16,8.44,1.44,10.84,1.8,7.56,1.16,13.64.42,21.14-.72,2.92-.44,9.92-2.74,12.02-2.6,3.7.26,1.02,9.44,0,11.82-7.94,18.5-35.78,19.04-43.3.26-.82-2.06-2.66-9.34-.68-10.58Z" fill="#211c16" />
      ),
      happy: (
        <path d="M77.04,133.82s19.54,20.38,45.92-.16" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6" />
      ),
      smoking: (
        <>
          <path d="M105.46,127.62s17.26,9.42-.22,13.22c0,0,15.18,12.14-2.84,13.66" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
          <path d="M107.64,141.74c13.54,1.98,34.02,4.94,47.56,6.92,13.54,1.98,14.4-15.58,3.06-17.22-8.84-1.28-11.14,8.6-1.74,9.96" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
        </>
      ),
      surprised: (
        <path d="M120.96,147.08c-1.94.98-8.28-2.18-10.64-2.76-7.42-1.82-13.56-1.62-21.12-1.18-2.94.18-10.12,1.86-12.2,1.52-3.66-.6-.16-9.5,1.06-11.78,9.56-17.72,37.34-15.78,43.16,3.6.64,2.12,1.82,9.54-.26,10.6Z" fill="#211c16" />
      ),
      neutral: (
        <path d="M86.4,122.66s11.58-4.52,27.2.04" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6" />
      ),
      sad: (
        <path d="M78.64,124.56s19.54-13.3,45.92.1" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6" />
      ),
      teeth: (
        <g transform="translate(100, 130) scale(2) translate(-50, -70)">
          <path d="M29.6,63.01c1.66-.78,7.57.97,9.72,1.22,6.78.78,12.23.28,18.96-.49,2.62-.3,8.89-1.86,10.77-1.75,3.32.18.91,6.39,0,7.99-7.13,12.51-32.09,12.87-38.83.17-.74-1.39-2.39-6.31-.62-7.14Z" fill="#211c16" />
          <path d="M47.14,66.23h0c1.37,0,2.47,1.11,2.47,2.47v2.6c0,.53-.43.96-.96.96h-3.02c-.53,0-.96-.43-.96-.96v-2.6c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(-175.68 47.14 68.26)" />
          <path d="M53.22,66.31h0c1.37,0,2.47,1.11,2.47,2.47v2.6c0,.53-.43.96-.96.96h-3.02c-.53,0-.96-.43-.96-.96v-2.6c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(177.14 53.22 68.34)" />
        </g>
      ),
      wavy: (
        <g transform="translate(100, 130) scale(2) translate(-50, -65)">
          <path d="M32.28,68.33c1.33-3.53,4.75-10.08,8.11-4.58s4.3,9.14,7.08.68,6.6.32,8.25,3.01c2.02,3.3,4.49,2.34,8.83-5.37" fill="none" stroke="#211c16" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2" />
        </g>
      ),
      goofy: (
        <g transform="translate(100, 125) scale(2) translate(-50, -70)">
          <path d="M46.29,71.4h0c1.37,0,2.47,1.11,2.47,2.47v3.56h-4.95v-3.56c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(-165.02 46.29 73.67)" />
          <path d="M52.01,71.95h0c1.37,0,2.47,1.11,2.47,2.47v3.56h-4.95v-3.56c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(177.14 52.01 74.2)" />
          <path d="M43.68,70s16.91,7.33,26.26-10.48" fill="none" stroke="#211c16" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2" />
        </g>
      ),
      kiss: (
        <g transform="translate(100, 130) scale(2) translate(-50, -70)">
          <path d="M54.01,73.79c-3.99,2.85-8.55.41-9.73-4-.36-1.36.71-2.72,1.76-2.08,1.15.69,1.39,5.62,5.13,4.77,3.47-.78,1.86-5.35,3.27-5.98,2.84-1.27,1.88,5.64-.43,7.29Z" fill="#211c16" />
        </g>
      )
    };
    return <svg viewBox="0 0 200 200" width={size} height={size}>{styles[style]}</svg>;
  };

  const HairPreview = ({ style, size = 40, color = "#8B5A2B" }: { style: string; size?: number; color?: string }) => {
    const styles: Record<string, React.JSX.Element | null> = {
      none: null,
      short: <path d="M136.28,92.54c-.88-3.08-5-25.1-6.1-25.86-2.08-1.44-5.38,3.82-7.42,5.22-13.68,9.34-30.14.2-39.52-10.66-1.02-1.2-1.6-3.76-3.44-3.7-1.96.06-2.52,2.2-3.66,3.46-7.58,8.2-16.62,15.7-27.06,19.86-4.14,1.64-8.64,2.42-12.86,3.86-4.8-12.46-3.12-26.4,4.3-37.52,16.72-25.04,56.9-29.38,81.7-14.8,2.08,1.22,4.52,3.98,6.8,4.82,2.82,1.02,7.44-.2,10.9.7,16.4,4.26,27.24,21.22,27.24,37.7,0,2.66-2.02,15.16-3.56,16.64-1.2,1.16-5.04-2.14-6.84-2.84-7.04-2.72-14.34-.94-20.46,3.18Z" fill={color} />,
      pigtails: (
        <>
          <path d="M149.9,78.36c-.88-3.08-13.94-25.1-15.02-25.86-2.08-1.44-5.38,3.82-7.42,5.22-13.68,9.34-30.14.2-39.52-10.66-1.02-1.2-1.6-3.76-3.44-3.7-1.96.06-2.52,2.2-3.66,3.46-7.58,8.2-16.62,15.7-27.06,19.86-4.14,1.64-8.64,2.42-12.86,3.86-4.8-12.46-3.12-26.4,4.3-37.52C61.94,7.94,102.1,3.6,126.9,18.16c2.08,1.22,4.52,3.98,6.8,4.82,2.82,1.02,7.44-.2,10.9.7,16.4,4.26,27.24,21.22,27.24,37.7,0,2.66-2.02,15.16-3.56,16.64-1.2,1.16-5.04-2.14-6.84-2.84-7.04-2.72-5.42-.94-11.54,3.18Z" fill={color} />
          <path d="M48.06,65.86h12.96v12.96c0,29.7-24.12,53.82-53.82,53.82h-12.96v-12.96c0-29.7,24.12-53.82,53.82-53.82Z" transform="translate(-38.8 20.5) rotate(-24.59)" fill={color} />
          <path d="M192.26,65.86h12.96v12.96c0,29.7-24.12,53.82-53.82,53.82h-12.96v-12.96c0-29.7,24.12-53.82,53.82-53.82Z" transform="translate(6.3 208.68) rotate(-63.48)" fill={color} />
        </>
      ),
      curly: <path d="M171.86,129.26c6.58-4.14,9.86-13.44,3.44-21.7-1.12-1.44-4.2-3.3-4.1-4.76.1-1.52,2.8-3.38,3.78-4.8,3.8-5.5,2.46-15.22-1.26-20.5-1.62-2.3-3.54-4-5.64-5.32,10.6-12.16,10.7-30.6-.38-42.9-11.98-13.28-32.44-14.34-45.72-2.36-2.06,1.86-3.78,3.92-5.24,6.14-.14-.28-.26-.52-.4-.72-7.36-11-22.28-15.32-32.56-5.64-.86.8-1.72,2.44-2.52,3.54-5.82-7-14.6-11.46-24.42-11.46-17.54,0-31.74,14.22-31.74,31.74s14.22,31.74,31.74,31.74c10.76,0,20.26-5.38,26-13.56,3.08,11.54,10.4,18.32,23.12,17.42,2.6-.18,10.56-3.12,11.04-2.82,1.42.84.92,3.76,1.28,5.22,2.96,12.08,10.86,17.26,22.9,14.58,3.38-.76,6.44-4.28,6,2.14-.46,6.44-1.34,10.56,2.56,16.66,2.18,3.42,4.62,5.8,7.12,7.32-3.24,2.32-5.36,6.12-5.36,10.42,0,4.98,2.84,9.3,7,11.42-1.48,1.5-2.42,3.56-2.42,5.82,0,4.56,3.68,8.24,8.24,8.24s8.24-3.68,8.24-8.24c0-2.28-.92-4.34-2.42-5.82,4.16-2.12,7-6.44,7-11.42,0-4.28-2.1-8.06-5.32-10.38Z" fill={color} />,
      spiky: <path d="M171.72,18.54c-7.24,0-13.12,5.88-13.12,13.12,0,.52.04,1.02.1,1.52-2.4-.98-5.04-1.52-7.8-1.52-8.88,0-16.44,5.56-19.44,13.4-7.58-3.74-16.12-5.84-25.14-5.84h-14.48c-11.2,0-21.62,3.24-30.42,8.82-2.04-9.36-10.36-16.36-20.34-16.36-1.56,0-3.08.18-4.56.52,0-.18.02-.34.02-.52,0-7.24-5.88-13.12-13.12-13.12s-13.12,5.88-13.12,13.12c0,6.7,5.02,12.2,11.48,13.02-.98,2.42-1.52,5.04-1.52,7.82,0,11.04,8.6,20.04,19.44,20.76-3.1,7.02-4.82,14.78-4.82,22.94,0,0,27.6-3.66,44.78-44.48,0,0,46.86,46.84,83.62,46.84v-2.34c0-8.62-1.92-16.78-5.36-24.1,8.04-2.88,13.8-10.56,13.8-19.58,0-2.76-.54-5.38-1.52-7.8.5.06,1,.1,1.52.1,7.24,0,13.12-5.88,13.12-13.12s-5.88-13.12-13.12-13.12Z" fill={color} />,
      side: <path d="M183.86,104.66c-16.9-54.18-1.82-50.12-28.86-68.48-14.58-9.9-26.08-11.02-35.74-8.7-24.88-10.98-60.58-5.6-76.12,17.64-7.42,11.12-9.08,25.06-4.3,37.52,4.22-1.42,8.72-2.2,12.86-3.86,10.44-4.16,19.48-11.66,27.06-19.86,1.16-1.24,1.7-3.38,3.66-3.46,1.84-.06,2.42,2.5,3.44,3.7,9.38,10.86,25.84,20,39.52,10.66.5-.34,1.08-.92,1.72-1.58,3.2,6.92,7.46,13.96,11.48,20.98.12.56.24.98.32,1.26.1-.06.2-.12.3-.18,10.2,17.84,18.42,35.46,2.92,50.64-.26.26-.5.5-.76.76-14.3,14.42,5.24,36.82,21.58,24.74,15.06-11.14,30.56-30.78,20.9-61.78Z" fill={color} />,
      messy: <path d="M161.22,66.54c-4-20.14-27.5-19.76-27.5-19.76-.44-3.72,10.64-10.76,10.64-10.76-12.42-5.86-27.28-.2-27.28-.2.66-26.8-35.04-29.74-35.04-29.74,10.86,9.58,4.88,28.16,4.88,28.16-4.44-10.18-24.4-8.22-24.4-8.22,7.76,2.34,8.88,11.94,8.88,11.94-32.16,2.16-32.6,22.7-32.6,22.7,16.42-2.16,26.4,9,26.4,9-16.42,2.16-15.96,16.04-15.96,16.04,6.78-.88,12.68.26,17.1,1.78,9.02,3.1,18.54,4.5,28.08,4.7l14.34.32c13.42.3,26.74-2.16,39.18-7.18h0s-5.98-5.86-5.98-5.86c9.32-1.56,19.3-12.92,19.3-12.92Z" fill={color} />,
      wavy: <path d="M159.96,40.44c-1.8-.14-5.26.9-6.28-.14-1.06-1.1-.64-4.34-1.04-6.04-1.54-6.5-9.66-12.02-16.08-12.78-8.74-1.06-15.12,3.84-21.36,9.12-2.64-3.14-3.44-5.88-6.94-8.46-9.92-7.36-23.92-4.9-30.92,5.1-1.24,1.78-4.4,9.34-5.28,9.48-.4.06-5.46-2.56-7.46-2.86-13.08-1.9-26.3,6.3-26,20.4.04,1.74,1.44,4.72.98,5.82-.98,2.4-4.64,1.66-6.9,2.34-12.12,3.58-17.24,22.74-9.7,32.7.08.1.24.28.5.54,10.92,10.88,29.1,8.9,37.66-3.9l6.38-9.54c11.24,6.4,21.82,5.96,30.08-4.62,1.6-2.06,4.76-9.92,5.3-10.1,1.58-.5,3.4,1.84,4.74,2.54,10.96,5.9,20.1,3.48,26.16-7.24,1.7-3.02,1.14-7.64,5.6-3.02,4.48,4.64,6.96,8.08,14.08,9.26,25.48,4.2,26.74-27.12,6.46-28.58Z" fill={color} />,
      buzz: <path d="M35.36,85.58s27.6-3.66,44.78-44.48c0,0,46.86,46.84,83.62,46.84v-48.8c0-5.8-4.7-10.52-10.52-10.52H45.88c-5.8,0-10.52,4.7-10.52,10.52v46.46Z" fill={color} />,
      bald: null
    };
    return <svg viewBox="-20 -20 240 240" width={size} height={size}>{styles[style]}</svg>;
  };

  const OptionPicker = ({ options, value, onChange, label, previewType, hairColor }: { options: string[]; value: string; onChange: (v: string) => void; label: string; previewType: string; hairColor?: string }) => (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ 
        fontSize: '12px', 
        fontWeight: 'bold', 
        color: '#6b7280', 
        textTransform: 'uppercase', 
        letterSpacing: '0.05em', 
        marginBottom: '8px', 
        display: 'block' 
      }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            style={{
              padding: '8px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: value === option ? '#1f2937' : '#f3f4f6',
              boxShadow: value === option ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
              transform: value === option ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.2s',
            }}
            title={option}
          >
            {previewType === 'face' && <FacePreview shape={option} />}
            {previewType === 'eyes' && <EyePreview style={option} />}
            {previewType === 'mouth' && <MouthPreview style={option} />}
            {previewType === 'hair' && <HairPreview style={option} color={hairColor} />}
          </button>
        ))}
      </div>
    </div>
  );

  const randomize = () => setAvatar({
    backgroundColor: backgroundColors[Math.floor(Math.random() * backgroundColors.length)],
    skinTone: skinTones[Math.floor(Math.random() * skinTones.length)],
    faceShape: ['round', 'square', 'triangle'][Math.floor(Math.random() * 3)],
    eyeStyle: ['dots', 'big', 'spiral', 'sunglasses', 'squareGlasses', 'roundGlasses', 'squiggle', 'wink', 'happy', 'anime', 'cute', 'grumpy'][Math.floor(Math.random() * 12)],
    mouthStyle: ['smile', 'happy', 'smoking', 'surprised', 'neutral', 'sad', 'teeth', 'wavy', 'goofy', 'kiss'][Math.floor(Math.random() * 10)],
    hairStyle: ['none', 'short', 'pigtails', 'curly', 'spiky', 'side', 'messy', 'wavy', 'buzz', 'bald'][Math.floor(Math.random() * 10)],
    hairColor: hairColors[Math.floor(Math.random() * hairColors.length)]
  });

  return (
    <div style={{ background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6)', padding: '24px', position: 'relative' }} onClick={() => setOpenPicker(null)}>
      {/* Close button */}
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#f3f4f6',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
        >
          <X style={{ width: '20px', height: '20px', color: '#6b7280' }} />
        </button>
      )}
      
      <div style={{ maxWidth: '1350px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', textAlign: 'center', color: '#1f2937', marginBottom: '20px' }}>
          Vytvoř si avatar
        </h1>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '24px', 
          alignItems: 'start',
        }}>
          {/* Left column: Avatar Preview + Colors + Buttons */}
          <div style={{ backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Avatar Preview */}
            <div 
              style={{ 
                backgroundColor: avatar.backgroundColor, 
                width: 200, 
                height: 200,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.3s',
                boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
              }}
            >
              <svg viewBox="0 0 200 200" style={{ width: '170px', height: '170px' }}>
                {renderFace()}
                {renderEyes()}
                {renderMouth()}
                {renderHair()}
              </svg>
            </div>
            
            {/* Color Circles */}
            <div style={{ position: 'relative', display: 'flex', gap: '24px', marginTop: '24px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ position: 'relative' }}>
                <ColorCircle 
                  color={avatar.backgroundColor} 
                  onClick={() => setOpenPicker(openPicker === 'bg' ? null : 'bg')}
                  label="Pozadí"
                  isOpen={openPicker === 'bg'}
                />
                {openPicker === 'bg' && (
                  <ColorPopup 
                    colors={backgroundColors}
                    value={avatar.backgroundColor}
                    onChange={(v) => updateAvatar('backgroundColor', v)}
                    onClose={() => setOpenPicker(null)}
                  />
                )}
              </div>
              
              <div style={{ position: 'relative' }}>
                <ColorCircle 
                  color={avatar.skinTone} 
                  onClick={() => setOpenPicker(openPicker === 'skin' ? null : 'skin')}
                  label="Pleť"
                  isOpen={openPicker === 'skin'}
                />
                {openPicker === 'skin' && (
                  <ColorPopup 
                    colors={skinTones}
                    value={avatar.skinTone}
                    onChange={(v) => updateAvatar('skinTone', v)}
                    onClose={() => setOpenPicker(null)}
                  />
                )}
              </div>
              
              <div style={{ position: 'relative' }}>
                <ColorCircle 
                  color={avatar.hairColor} 
                  onClick={() => setOpenPicker(openPicker === 'hair' ? null : 'hair')}
                  label="Vlasy"
                  isOpen={openPicker === 'hair'}
                />
                {openPicker === 'hair' && (
                  <ColorPopup 
                    colors={hairColors}
                    value={avatar.hairColor}
                    onChange={(v) => updateAvatar('hairColor', v)}
                    onClose={() => setOpenPicker(null)}
                  />
                )}
              </div>
            </div>
            
            {/* Random & Reset buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={randomize}
                style={{
                  background: 'linear-gradient(to right, #8b5cf6, #ec4899)',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '9999px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontSize: '14px',
                }}
              >
                🎲 Random
              </button>
              <button
                onClick={() => setAvatar(DEFAULT_AVATAR)}
                style={{
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  padding: '10px 20px',
                  borderRadius: '9999px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ↺ Reset
              </button>
            </div>
            
            {/* Save button */}
            {onSave && (
              <button
                onClick={() => onSave(avatar)}
                style={{
                  background: 'linear-gradient(to right, #6366f1, #8b5cf6)',
                  color: 'white',
                  padding: '12px 32px',
                  borderRadius: '9999px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  marginTop: '16px',
                  width: '100%',
                }}
              >
                ✓ Uložit avatar
              </button>
            )}
          </div>
          
          {/* Right column: Controls (Face, Eyes, Mouth, Hair) */}
          <div style={{ backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '24px', maxHeight: '480px', overflowY: 'auto' }}>
            <OptionPicker
              label="Obličej"
              options={['round', 'square', 'triangle']}
              value={avatar.faceShape}
              onChange={(v) => updateAvatar('faceShape', v)}
              previewType="face"
            />
            
            <OptionPicker
              label="Oči"
              options={['dots', 'big', 'spiral', 'sunglasses', 'squareGlasses', 'roundGlasses', 'squiggle', 'wink', 'happy', 'anime', 'cute', 'grumpy']}
              value={avatar.eyeStyle}
              onChange={(v) => updateAvatar('eyeStyle', v)}
              previewType="eyes"
            />
            
            <OptionPicker
              label="Ústa"
              options={['smile', 'happy', 'smoking', 'surprised', 'neutral', 'sad', 'teeth', 'wavy', 'goofy', 'kiss']}
              value={avatar.mouthStyle}
              onChange={(v) => updateAvatar('mouthStyle', v)}
              previewType="mouth"
            />
            
            <OptionPicker
              label="Účes"
              options={['none', 'short', 'pigtails', 'curly', 'spiky', 'side', 'messy', 'wavy', 'buzz', 'bald']}
              value={avatar.hairStyle}
              onChange={(v) => updateAvatar('hairStyle', v)}
              previewType="hair"
              hairColor={avatar.hairColor}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Component to render just the avatar SVG (for display purposes)
export function AvatarDisplay({ avatar, size = 40 }: { avatar: AvatarConfig; size?: number }) {
  const renderFace = () => {
    const shapes: Record<string, React.JSX.Element> = {
      round: <circle cx="100" cy="105" r="63" fill={avatar.skinTone} />,
      square: <rect x="37" y="42" width="126" height="126" rx="15" ry="15" fill={avatar.skinTone} />,
      triangle: <path d="M108.2,161.16l61.12-105.88c3.84-6.66-.96-14.96-8.64-14.96H38.42c-7.68,0-12.46,8.3-8.62,14.94l61.12,105.88c3.84,6.66,13.44,6.66,17.28,0Z" fill={avatar.skinTone} transform="translate(100, 95) scale(1.2) translate(-100, -95)" />
    };
    return shapes[avatar.faceShape];
  };

  const renderEyes = () => {
    const styles: Record<string, React.JSX.Element> = {
      dots: (
        <>
          <circle cx="78.86" cy="111.32" r="10.44" fill="#000" />
          <circle cx="119.06" cy="111" r="10.44" fill="#000" />
          <path d="M80.46,81.28s-4.44,9.74-18.02,12.24" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M118.68,81.28s4.44,9.74,18.02,12.24" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      ),
      big: (
        <>
          <circle cx="82.64" cy="107.16" r="13.8" fill="#000" />
          <circle cx="120.98" cy="107.16" r="13.8" fill="#000" />
          <path d="M65.22,87.74s6.68-8.36,20.46-7.48" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M134.78,82.08s-8.84-6.02-21.76-1.1" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      ),
      spiral: (
        <>
          <circle cx="79.06" cy="102.9" r="18.1" fill="#fff" />
          <path d="M87.58,111.06c-6.5,5.68-15.02,3.9-19.08-2.7-3.52-5.72-1.62-13.22,4.14-16.68,4.6-2.78,10.58-1.3,13.34,3.3,2.22,3.68,1.04,8.46-2.64,10.68-2.94,1.78-6.76.82-8.54-2.12-1.42-2.36-.66-5.42,1.7-6.84" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="120.94" cy="103.62" r="18.1" fill="#fff" />
          <path d="M129.44,111.78c-6.5,5.68-15.02,3.9-19.08-2.7-3.52-5.72-1.62-13.22,4.14-16.68,4.6-2.78,10.58-1.3,13.34,3.3,2.22,3.68,1.04,8.46-2.64,10.68-2.94,1.78-6.76.82-8.54-2.12-1.42-2.36-.66-5.42,1.7-6.84" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="4" />
          <path d="M82.32,70.82s-3.58,7.86-14.52,9.88" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M113.12,70.82s3.58,7.86,14.52,9.88" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
        </>
      ),
      sunglasses: (
        <path d="M140.62,76.24c-13.14,3.28-27.62.82-40.48,6.7-11.04-4.28-23.12-5.16-34.78-5.2-6.22-2.02-13.58-3.32-14.46,6.06-.9,3.84,6.94,15.4,8.18,18.82,2.7,5.24,7.52,8.42,12.68,8.38,22.72,3.72,23.36-16.9,33.26-7.82,4,5,9.56,7.82,15.36,7.86,7.84.36,16.82.3,20.78-8.44,3.92-7.18,16.14-26.78-.58-26.36Z" fill="#000" />
      ),
      squareGlasses: (
        <>
          <rect x="47.34" y="72.9" width="47.4" height="36.9" rx="5.48" ry="5.48" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <rect x="105.28" y="72.9" width="47.4" height="36.9" rx="5.48" ry="5.48" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <path d="M94.72,91.36c0-3.26,2.36-5.9,5.28-5.9s5.28,2.64,5.28,5.9" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="73.88" cy="90.88" r="5.78" fill="#211c16" />
          <circle cx="125.84" cy="91.36" r="5.78" fill="#211c16" />
        </>
      ),
      roundGlasses: (
        <>
          <circle cx="78.48" cy="93.68" r="20.86" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="121.52" cy="93.68" r="20.86" fill="none" stroke="#000" strokeMiterlimit={10} strokeWidth="4" />
          <circle cx="76.46" cy="99.64" r="5.78" fill="#211c16" />
          <circle cx="119.44" cy="99.64" r="5.78" fill="#211c16" />
        </>
      ),
      squiggle: (
        <>
          <path d="M87.28,97.5c1.88-2.8,12.02-6.28,13.04-2.16,1.3,5.24-13.28,1.42-9.28,9.88.6,1.26,8.12,4.74,3.44,7.06-5.28,2.6-10.9-9.02-7.86-13.44-8.98,1.4-1.06-8.74-7.24-12.76-3.16-2.04-6.18-.58-8.48,1.94-1.82,1.98-2.92,7.56-6.28,4.96-3-2.32,3.76-9.66,6.06-11.08,11-6.82,18.88,5.32,16.62,15.62Z" fill="#211c16" />
          <path d="M120.52,88.48c9.6-1.98,15.98,6.18,14.54,15.2-.44,2.78-3.5,4.4-4.9,2.38-1.54-2.2,2.02-11.4-5.5-12.9-6.98-1.38-7.74,8.28-10.84,8.28-6.24.02,1.14-11.82,6.7-12.98Z" fill="#211c16" />
        </>
      ),
      wink: (
        <>
          <path d="M131.08,102.96s-6.48-20.32-24.7-6.54" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
          <path d="M92.88,95.16s-17-12.88-23.96,8.86" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
        </>
      ),
      happy: (
        <>
          <path d="M69.58,93.68s11.48,17.98,25.54,0" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
          <path d="M104.86,93.68s11.48,17.98,25.54,0" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6.28" />
        </>
      ),
      anime: (
        <>
          <path d="M64.72,95.38c0-10.72,7.34-19.4,16.4-19.4s16.4,8.68,16.4,19.4" fill="#fff" />
          <path d="M71.92,95.38c0-5.56,4.12-10.08,9.2-10.08s9.2,4.5,9.2,10.08" fill="#1c1468" />
          <path d="M102.48,95.38c0-10.72,7.34-19.4,16.4-19.4s16.4,8.68,16.4,19.4" fill="#fff" />
          <path d="M109.7,95.38c0-5.56,4.12-10.08,9.2-10.08s9.2,4.5,9.2,10.08" fill="#1c1468" />
          <path d="M88.82,114.78c-5.52-8.1-.44-17.12,8.42-19.28,2.72-.66,5.4,1.54,4.08,3.62-1.44,2.26-11.3,2.54-9.78,10.06,1.42,6.98,10.62,3.96,11.82,6.8,2.42,5.74-11.36,3.5-14.56-1.18Z" fill="#211c16" />
        </>
      ),
      cute: (
        <>
          <ellipse cx="78.7" cy="88.6" rx="14.22" ry="16.82" fill="#fff" />
          <ellipse cx="74.98" cy="87.52" rx="7.98" ry="8.74" fill="#1c1468" />
          <ellipse cx="116.42" cy="88.6" rx="14.22" ry="16.82" fill="#fff" />
          <ellipse cx="112.7" cy="87.52" rx="7.98" ry="8.74" fill="#1c1468" />
          <path d="M81,117.92c-5.52-8.1-.44-17.12,8.42-19.28,2.72-.66,5.4,1.54,4.08,3.62-1.44,2.26-11.3,2.54-9.78,10.06,1.42,6.98,10.62,3.96,11.82,6.8,2.42,5.74-11.36,3.5-14.56-1.18Z" fill="#211c16" />
        </>
      ),
      grumpy: (
        <>
          <path d="M66.04,84.54s12.66,9.66,26.5-.22" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <path d="M107.46,84.54s12.66,9.66,26.5-.22" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="5.96" />
          <circle cx="84.1" cy="108.68" r="11" fill="#000" />
          <circle cx="121.36" cy="104.24" r="11" fill="#000" />
        </>
      )
    };
    return styles[avatar.eyeStyle];
  };

  const renderMouth = () => {
    const styles: Record<string, React.JSX.Element> = {
      smile: (
        <path d="M77.06,122.2c1.84-1.16,8.44,1.44,10.84,1.8,7.56,1.16,13.64.42,21.14-.72,2.92-.44,9.92-2.74,12.02-2.6,3.7.26,1.02,9.44,0,11.82-7.94,18.5-35.78,19.04-43.3.26-.82-2.06-2.66-9.34-.68-10.58Z" fill="#211c16" />
      ),
      happy: (
        <path d="M77.04,133.82s19.54,20.38,45.92-.16" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6" />
      ),
      smoking: (
        <>
          <path d="M105.46,127.62s17.26,9.42-.22,13.22c0,0,15.18,12.14-2.84,13.66" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
          <path d="M107.64,141.74c13.54,1.98,34.02,4.94,47.56,6.92,13.54,1.98,14.4-15.58,3.06-17.22-8.84-1.28-11.14,8.6-1.74,9.96" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
        </>
      ),
      surprised: (
        <path d="M120.96,147.08c-1.94.98-8.28-2.18-10.64-2.76-7.42-1.82-13.56-1.62-21.12-1.18-2.94.18-10.12,1.86-12.2,1.52-3.66-.6-.16-9.5,1.06-11.78,9.56-17.72,37.34-15.78,43.16,3.6.64,2.12,1.82,9.54-.26,10.6Z" fill="#211c16" />
      ),
      neutral: (
        <path d="M86.4,122.66s11.58-4.52,27.2.04" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6" />
      ),
      sad: (
        <path d="M78.64,124.56s19.54-13.3,45.92.1" fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="6" />
      ),
      teeth: (
        <g transform="translate(100, 130) scale(2) translate(-50, -70)">
          <path d="M29.6,63.01c1.66-.78,7.57.97,9.72,1.22,6.78.78,12.23.28,18.96-.49,2.62-.3,8.89-1.86,10.77-1.75,3.32.18.91,6.39,0,7.99-7.13,12.51-32.09,12.87-38.83.17-.74-1.39-2.39-6.31-.62-7.14Z" fill="#211c16" />
          <path d="M47.14,66.23h0c1.37,0,2.47,1.11,2.47,2.47v2.6c0,.53-.43.96-.96.96h-3.02c-.53,0-.96-.43-.96-.96v-2.6c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(-175.68 47.14 68.26)" />
          <path d="M53.22,66.31h0c1.37,0,2.47,1.11,2.47,2.47v2.6c0,.53-.43.96-.96.96h-3.02c-.53,0-.96-.43-.96-.96v-2.6c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(177.14 53.22 68.34)" />
        </g>
      ),
      wavy: (
        <g transform="translate(100, 130) scale(2) translate(-50, -65)">
          <path d="M32.28,68.33c1.33-3.53,4.75-10.08,8.11-4.58s4.3,9.14,7.08.68,6.6.32,8.25,3.01c2.02,3.3,4.49,2.34,8.83-5.37" fill="none" stroke="#211c16" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2" />
        </g>
      ),
      goofy: (
        <g transform="translate(100, 125) scale(2) translate(-50, -70)">
          <path d="M46.29,71.4h0c1.37,0,2.47,1.11,2.47,2.47v3.56h-4.95v-3.56c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(-165.02 46.29 73.67)" />
          <path d="M52.01,71.95h0c1.37,0,2.47,1.11,2.47,2.47v3.56h-4.95v-3.56c0-1.37,1.11-2.47,2.47-2.47Z" fill="#fff" transform="rotate(177.14 52.01 74.2)" />
          <path d="M43.68,70s16.91,7.33,26.26-10.48" fill="none" stroke="#211c16" strokeLinecap="round" strokeMiterlimit={10} strokeWidth="2" />
        </g>
      ),
      kiss: (
        <g transform="translate(100, 130) scale(2) translate(-50, -70)">
          <path d="M54.01,73.79c-3.99,2.85-8.55.41-9.73-4-.36-1.36.71-2.72,1.76-2.08,1.15.69,1.39,5.62,5.13,4.77,3.47-.78,1.86-5.35,3.27-5.98,2.84-1.27,1.88,5.64-.43,7.29Z" fill="#211c16" />
        </g>
      )
    };
    return styles[avatar.mouthStyle];
  };

  const renderHair = () => {
    const styles: Record<string, React.JSX.Element | null> = {
      none: null,
      short: <path d="M136.28,92.54c-.88-3.08-5-25.1-6.1-25.86-2.08-1.44-5.38,3.82-7.42,5.22-13.68,9.34-30.14.2-39.52-10.66-1.02-1.2-1.6-3.76-3.44-3.7-1.96.06-2.52,2.2-3.66,3.46-7.58,8.2-16.62,15.7-27.06,19.86-4.14,1.64-8.64,2.42-12.86,3.86-4.8-12.46-3.12-26.4,4.3-37.52,16.72-25.04,56.9-29.38,81.7-14.8,2.08,1.22,4.52,3.98,6.8,4.82,2.82,1.02,7.44-.2,10.9.7,16.4,4.26,27.24,21.22,27.24,37.7,0,2.66-2.02,15.16-3.56,16.64-1.2,1.16-5.04-2.14-6.84-2.84-7.04-2.72-14.34-.94-20.46,3.18Z" fill={avatar.hairColor} />,
      pigtails: (
        <>
          <path d="M149.9,78.36c-.88-3.08-13.94-25.1-15.02-25.86-2.08-1.44-5.38,3.82-7.42,5.22-13.68,9.34-30.14.2-39.52-10.66-1.02-1.2-1.6-3.76-3.44-3.7-1.96.06-2.52,2.2-3.66,3.46-7.58,8.2-16.62,15.7-27.06,19.86-4.14,1.64-8.64,2.42-12.86,3.86-4.8-12.46-3.12-26.4,4.3-37.52C61.94,7.94,102.1,3.6,126.9,18.16c2.08,1.22,4.52,3.98,6.8,4.82,2.82,1.02,7.44-.2,10.9.7,16.4,4.26,27.24,21.22,27.24,37.7,0,2.66-2.02,15.16-3.56,16.64-1.2,1.16-5.04-2.14-6.84-2.84-7.04-2.72-5.42-.94-11.54,3.18Z" fill={avatar.hairColor} />
          <path d="M48.06,65.86h12.96v12.96c0,29.7-24.12,53.82-53.82,53.82h-12.96v-12.96c0-29.7,24.12-53.82,53.82-53.82Z" transform="translate(-38.8 20.5) rotate(-24.59)" fill={avatar.hairColor} />
          <path d="M192.26,65.86h12.96v12.96c0,29.7-24.12,53.82-53.82,53.82h-12.96v-12.96c0-29.7,24.12-53.82,53.82-53.82Z" transform="translate(6.3 208.68) rotate(-63.48)" fill={avatar.hairColor} />
        </>
      ),
      curly: <path d="M171.86,129.26c6.58-4.14,9.86-13.44,3.44-21.7-1.12-1.44-4.2-3.3-4.1-4.76.1-1.52,2.8-3.38,3.78-4.8,3.8-5.5,2.46-15.22-1.26-20.5-1.62-2.3-3.54-4-5.64-5.32,10.6-12.16,10.7-30.6-.38-42.9-11.98-13.28-32.44-14.34-45.72-2.36-2.06,1.86-3.78,3.92-5.24,6.14-.14-.28-.26-.52-.4-.72-7.36-11-22.28-15.32-32.56-5.64-.86.8-1.72,2.44-2.52,3.54-5.82-7-14.6-11.46-24.42-11.46-17.54,0-31.74,14.22-31.74,31.74s14.22,31.74,31.74,31.74c10.76,0,20.26-5.38,26-13.56,3.08,11.54,10.4,18.32,23.12,17.42,2.6-.18,10.56-3.12,11.04-2.82,1.42.84.92,3.76,1.28,5.22,2.96,12.08,10.86,17.26,22.9,14.58,3.38-.76,6.44-4.28,6,2.14-.46,6.44-1.34,10.56,2.56,16.66,2.18,3.42,4.62,5.8,7.12,7.32-3.24,2.32-5.36,6.12-5.36,10.42,0,4.98,2.84,9.3,7,11.42-1.48,1.5-2.42,3.56-2.42,5.82,0,4.56,3.68,8.24,8.24,8.24s8.24-3.68,8.24-8.24c0-2.28-.92-4.34-2.42-5.82,4.16-2.12,7-6.44,7-11.42,0-4.28-2.1-8.06-5.32-10.38Z" fill={avatar.hairColor} />,
      spiky: <path d="M171.72,18.54c-7.24,0-13.12,5.88-13.12,13.12,0,.52.04,1.02.1,1.52-2.4-.98-5.04-1.52-7.8-1.52-8.88,0-16.44,5.56-19.44,13.4-7.58-3.74-16.12-5.84-25.14-5.84h-14.48c-11.2,0-21.62,3.24-30.42,8.82-2.04-9.36-10.36-16.36-20.34-16.36-1.56,0-3.08.18-4.56.52,0-.18.02-.34.02-.52,0-7.24-5.88-13.12-13.12-13.12s-13.12,5.88-13.12,13.12c0,6.7,5.02,12.2,11.48,13.02-.98,2.42-1.52,5.04-1.52,7.82,0,11.04,8.6,20.04,19.44,20.76-3.1,7.02-4.82,14.78-4.82,22.94,0,0,27.6-3.66,44.78-44.48,0,0,46.86,46.84,83.62,46.84v-2.34c0-8.62-1.92-16.78-5.36-24.1,8.04-2.88,13.8-10.56,13.8-19.58,0-2.76-.54-5.38-1.52-7.8.5.06,1,.1,1.52.1,7.24,0,13.12-5.88,13.12-13.12s-5.88-13.12-13.12-13.12Z" fill={avatar.hairColor} />,
      side: <path d="M183.86,104.66c-16.9-54.18-1.82-50.12-28.86-68.48-14.58-9.9-26.08-11.02-35.74-8.7-24.88-10.98-60.58-5.6-76.12,17.64-7.42,11.12-9.08,25.06-4.3,37.52,4.22-1.42,8.72-2.2,12.86-3.86,10.44-4.16,19.48-11.66,27.06-19.86,1.16-1.24,1.7-3.38,3.66-3.46,1.84-.06,2.42,2.5,3.44,3.7,9.38,10.86,25.84,20,39.52,10.66.5-.34,1.08-.92,1.72-1.58,3.2,6.92,7.46,13.96,11.48,20.98.12.56.24.98.32,1.26.1-.06.2-.12.3-.18,10.2,17.84,18.42,35.46,2.92,50.64-.26.26-.5.5-.76.76-14.3,14.42,5.24,36.82,21.58,24.74,15.06-11.14,30.56-30.78,20.9-61.78Z" fill={avatar.hairColor} />,
      messy: <path d="M161.22,66.54c-4-20.14-27.5-19.76-27.5-19.76-.44-3.72,10.64-10.76,10.64-10.76-12.42-5.86-27.28-.2-27.28-.2.66-26.8-35.04-29.74-35.04-29.74,10.86,9.58,4.88,28.16,4.88,28.16-4.44-10.18-24.4-8.22-24.4-8.22,7.76,2.34,8.88,11.94,8.88,11.94-32.16,2.16-32.6,22.7-32.6,22.7,16.42-2.16,26.4,9,26.4,9-16.42,2.16-15.96,16.04-15.96,16.04,6.78-.88,12.68.26,17.1,1.78,9.02,3.1,18.54,4.5,28.08,4.7l14.34.32c13.42.3,26.74-2.16,39.18-7.18h0s-5.98-5.86-5.98-5.86c9.32-1.56,19.3-12.92,19.3-12.92Z" fill={avatar.hairColor} />,
      wavy: <path d="M159.96,40.44c-1.8-.14-5.26.9-6.28-.14-1.06-1.1-.64-4.34-1.04-6.04-1.54-6.5-9.66-12.02-16.08-12.78-8.74-1.06-15.12,3.84-21.36,9.12-2.64-3.14-3.44-5.88-6.94-8.46-9.92-7.36-23.92-4.9-30.92,5.1-1.24,1.78-4.4,9.34-5.28,9.48-.4.06-5.46-2.56-7.46-2.86-13.08-1.9-26.3,6.3-26,20.4.04,1.74,1.44,4.72.98,5.82-.98,2.4-4.64,1.66-6.9,2.34-12.12,3.58-17.24,22.74-9.7,32.7.08.1.24.28.5.54,10.92,10.88,29.1,8.9,37.66-3.9l6.38-9.54c11.24,6.4,21.82,5.96,30.08-4.62,1.6-2.06,4.76-9.92,5.3-10.1,1.58-.5,3.4,1.84,4.74,2.54,10.96,5.9,20.1,3.48,26.16-7.24,1.7-3.02,1.14-7.64,5.6-3.02,4.48,4.64,6.96,8.08,14.08,9.26,25.48,4.2,26.74-27.12,6.46-28.58Z" fill={avatar.hairColor} />,
      buzz: <path d="M35.36,85.58s27.6-3.66,44.78-44.48c0,0,46.86,46.84,83.62,46.84v-48.8c0-5.8-4.7-10.52-10.52-10.52H45.88c-5.8,0-10.52,4.7-10.52,10.52v46.46Z" fill={avatar.hairColor} />,
      bald: null
    };
    return styles[avatar.hairStyle];
  };

  return (
    <div 
      style={{ 
        backgroundColor: avatar.backgroundColor, 
        width: size, 
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <svg viewBox="-20 -20 240 240" style={{ width: size * 1, height: size * 1 }}>
        {renderFace()}
        {renderEyes()}
        {renderMouth()}
        {renderHair()}
      </svg>
    </div>
  );
}

