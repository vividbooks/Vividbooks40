import IzolovanyRezim from '../../imports/IzolovanyRezim-61-3463';

interface IconProps {
  className?: string;
}

export function WorkbookIcon({ className }: IconProps) {
  return (
    <div className={className}>
      <IzolovanyRezim />
    </div>
  );
}
