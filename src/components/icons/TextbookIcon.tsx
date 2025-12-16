import IzolovanyRezim from '../../imports/IzolovanyRezim';

interface IconProps {
  className?: string;
}

export function TextbookIcon({ className }: IconProps) {
  return (
    <div className={className}>
      <IzolovanyRezim />
    </div>
  );
}
