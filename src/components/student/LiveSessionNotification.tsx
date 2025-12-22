/**
 * Live Session Notification Component
 * 
 * Shows a notification to students when their teacher starts a live session.
 * Automatically connects them to the session.
 */

import React from 'react';
import { Radio, Play, X, Users } from 'lucide-react';
import { useLiveSessionNotification } from '../../hooks/useLiveSessionNotification';

export function LiveSessionNotification() {
  const { pendingSession, joinSession, dismissSession, isConnected } = useLiveSessionNotification();

  if (!pendingSession) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        animation: 'slide-up 0.3s ease-out',
      }}
    >
      <div 
        style={{
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '20px',
          maxWidth: '360px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        {/* Pulsing indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{ position: 'relative' }}>
            <Radio style={{ width: '24px', height: '24px', color: 'white' }} />
            <span 
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '12px',
                height: '12px',
                backgroundColor: '#ef4444',
                borderRadius: '50%',
                animation: 'pulse 2s infinite',
              }}
            />
          </div>
          <span style={{ fontWeight: 'bold', color: 'white', fontSize: '18px' }}>Živá lekce!</span>
        </div>

        <p style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '16px', fontSize: '15px' }}>
          Učitel spustil <strong>{pendingSession.documentTitle}</strong>
        </p>

        <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users style={{ width: '16px', height: '16px' }} />
          <span>Připojuji tě automaticky...</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={joinSession}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: 'white',
              color: '#4f46e5',
              fontWeight: 600,
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            <Play style={{ width: '20px', height: '20px' }} />
            Připojit se nyní
          </button>
          <button
            onClick={dismissSession}
            style={{
              padding: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
            title="Zavřít"
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
