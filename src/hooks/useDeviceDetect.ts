/**
 * Device Detection Hook
 * 
 * Detects mobile devices using multiple methods:
 * - User agent string
 * - Touch capability
 * - Screen width (as fallback)
 */

import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
}

export function useDeviceDetect(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(getDeviceInfo());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceInfo;
}

function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      screenWidth: 1920,
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const screenWidth = window.innerWidth;

  // Check for mobile user agents
  const mobileKeywords = [
    'iphone', 'ipod', 'android', 'blackberry', 'windows phone',
    'opera mini', 'iemobile', 'mobile safari', 'webos'
  ];
  const tabletKeywords = ['ipad', 'tablet', 'playbook', 'silk'];
  
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  const isTabletUA = tabletKeywords.some(keyword => userAgent.includes(keyword));
  
  // Check for touch capability
  const isTouchDevice = 'ontouchstart' in window || 
    navigator.maxTouchPoints > 0 || 
    (navigator as any).msMaxTouchPoints > 0;

  // Combined detection:
  // - Mobile: mobile user agent OR (touch device AND small screen)
  // - Tablet: tablet user agent OR (touch device AND medium screen)
  // - Desktop: everything else
  
  const isMobile = isMobileUA || (isTouchDevice && screenWidth < 768);
  const isTablet = isTabletUA || (isTouchDevice && screenWidth >= 768 && screenWidth < 1024);
  const isDesktop = !isMobile && !isTablet;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice,
    screenWidth,
  };
}

// Simple function for components that don't need reactivity
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'iphone', 'ipod', 'android', 'blackberry', 'windows phone',
    'opera mini', 'iemobile', 'mobile safari', 'webos'
  ];
  
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768;
  
  return isMobileUA || (isTouchDevice && isSmallScreen);
}

// Check if device is touch-capable (tablets + phones)
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'iphone', 'ipod', 'android', 'ipad', 'tablet', 'blackberry', 
    'windows phone', 'opera mini', 'iemobile', 'mobile safari', 'webos'
  ];
  
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return isMobileUA || hasTouch;
}
