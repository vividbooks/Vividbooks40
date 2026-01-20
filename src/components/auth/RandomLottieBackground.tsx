import { useEffect, useState, useRef } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';

// Lottie animace z knihovny Vividbooks - vzdělávací témata
const LIBRARY_ANIMATIONS: string[] = [
  'https://api.vividbooks.com/v1/knowledge-animation/data/8031.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/5441.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/5423.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/9634.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/8244.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/7388.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/10672.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/8432.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/1775.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/7527.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/11347.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/11179.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/11023.json?user-code=pascal',
  'https://api.vividbooks.com/v1/knowledge-animation/data/11001.json?user-code=pascal',
];

// Store last used animation in sessionStorage to avoid repeats
const LAST_ANIMATION_KEY = 'vivid-last-animation';

const getRandomAnimation = (): string | null => {
  if (LIBRARY_ANIMATIONS.length === 0) return null;
  
  // Get last used animation
  const lastUrl = sessionStorage.getItem(LAST_ANIMATION_KEY);
  
  // If only one animation, just return it
  if (LIBRARY_ANIMATIONS.length === 1) return LIBRARY_ANIMATIONS[0];
  
  // Filter out the last used animation
  const availableAnimations = lastUrl 
    ? LIBRARY_ANIMATIONS.filter(url => url !== lastUrl)
    : LIBRARY_ANIMATIONS;
  
  // Select random from available
  const selectedUrl = availableAnimations[Math.floor(Math.random() * availableAnimations.length)];
  
  // Store for next time
  sessionStorage.setItem(LAST_ANIMATION_KEY, selectedUrl);
  
  return selectedUrl;
};

export function RandomLottieBackground() {
  const [animationData, setAnimationData] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedUrl] = useState(() => getRandomAnimation());
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (!selectedUrl) return;
    
    let cancelled = false;
    const timeout = setTimeout(() => {
      // If animation hasn't loaded in 3 seconds, just skip it
      if (!cancelled) {
        cancelled = true;
      }
    }, 3000);
    
    // Load the selected animation with error handling (non-blocking)
    fetch(selectedUrl)
      .then(res => {
        if (cancelled) return null;
        if (!res.ok) throw new Error('Failed to fetch animation');
        return res.json();
      })
      .then(data => {
        if (cancelled || !data) return;
        clearTimeout(timeout);
        // Validate Lottie data structure
        if (data && (data.v || data.layers)) {
          setAnimationData(data);
          // Fade in animation after it loads
          setTimeout(() => setIsVisible(true), 100);
        }
      })
      .catch(err => {
        console.error('Failed to load background animation:', err);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [selectedUrl]);

  // Don't render anything if animation not loaded yet - page loads immediately
  if (!animationData) {
    return null;
  }

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center transition-opacity duration-1000"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <div className="w-full h-full max-w-2xl max-h-2xl">
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={true}
          autoplay={true}
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}

