const LOGO_SRC = '/logo_parachute.png';

// Maps Tailwind text-color classes to CSS filter strings that tint the black silhouette
function getFilter(className?: string): string {
  if (!className) return '';
  if (className.includes('text-white'))        return 'brightness(0) invert(1)';
  if (className.includes('text-orange-400'))   return 'brightness(0) saturate(100%) invert(70%) sepia(80%) saturate(600%) hue-rotate(5deg) brightness(105%)';
  if (className.includes('text-orange-500'))   return 'brightness(0) saturate(100%) invert(55%) sepia(90%) saturate(700%) hue-rotate(2deg) brightness(100%)';
  if (className.includes('text-orange-600'))   return 'brightness(0) saturate(100%) invert(45%) sepia(90%) saturate(700%) hue-rotate(5deg) brightness(95%)';
  if (className.includes('text-green-600'))    return 'brightness(0) saturate(100%) invert(40%) sepia(60%) saturate(500%) hue-rotate(100deg) brightness(90%)';
  if (className.includes('text-sky-600'))      return 'brightness(0) saturate(100%) invert(35%) sepia(80%) saturate(500%) hue-rotate(185deg) brightness(95%)';
  if (className.includes('text-gray-300'))     return 'brightness(0) saturate(0%) invert(85%)';
  if (className.includes('text-gray-400'))     return 'brightness(0) saturate(0%) invert(70%)';
  if (className.includes('text-[#001A4D]'))   return 'brightness(0) saturate(100%) invert(10%) sepia(40%) saturate(800%) hue-rotate(195deg) brightness(80%)';
  if (className.includes('text-[#2563EB]'))   return 'brightness(0) saturate(100%) invert(30%) sepia(90%) saturate(600%) hue-rotate(210deg) brightness(100%)';
  return '';
}

// Strip text-* color classes since we use filter instead of currentColor
function stripColorClasses(className?: string): string {
  if (!className) return '';
  return className
    .split(' ')
    .filter((c) => !c.startsWith('text-'))
    .join(' ');
}

export function ParachuteIcon({ className }: { className?: string }) {
  const filter = getFilter(className);
  const cls = stripColorClasses(className);
  return (
    <img
      src={LOGO_SRC}
      alt=""
      aria-hidden="true"
      className={cls}
      style={filter ? { filter } : undefined}
    />
  );
}

// ParachuteDropIcon and AltitudeIcon use the same image — differentiation was cosmetic
export function ParachuteDropIcon({ className }: { className?: string }) {
  return <ParachuteIcon className={className} />;
}

export function AltitudeIcon({ className }: { className?: string }) {
  return <ParachuteIcon className={className} />;
}
