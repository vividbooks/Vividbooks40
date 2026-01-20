import IzolovanyRezim from '../../imports/IzolovanyRezim-61-3430';

interface IconProps {
  className?: string;
}

export function MethodologyIcon({ className }: IconProps) {
  return (
    <div className={className}>
      <IzolovanyRezim />
    </div>
  );
}
