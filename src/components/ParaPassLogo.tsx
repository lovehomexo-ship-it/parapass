const LOGO_SRC = '/Logo_ParaPass.png';

interface ParaPassLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark';
  mobile?: boolean;
}

export function ParaPassLogo({ mobile = false }: ParaPassLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="ParaPass"
      style={{
        height: mobile ? '120px' : '144px',
        width: 'auto',
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
        marginTop: '8px',
      }}
    />
  );
}

export const PARAPASS_FAVICON_SVG = '';
