interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 'w-36',
    md: 'w-48',
    lg: 'w-72'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src="https://app.vividbooks.com/assets/img/loading-new.gif" 
        alt="Loading..." 
        className={`${sizeMap[size]} h-auto`}
      />
    </div>
  );
}
