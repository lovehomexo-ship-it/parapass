// Le logo est passé au WebP à fond TRANSPARENT (chunk ALPH). L'ancien PNG
// portait sa marge dans l'image elle-même, d'où le `marginTop` compensatoire
// qui traînait ici : le nouveau fichier est cadré au trait, la marge se règle
// donc en CSS, là où on la voit.
const LOGO_SRC = '/logo-parapass.webp';

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
      }}
    />
  );
}

export const PARAPASS_FAVICON_SVG = '';
