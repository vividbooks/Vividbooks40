import React, { useState } from 'react';
import SimpleAvatarCreator, { AvatarConfig, DEFAULT_AVATAR, AvatarDisplay } from './SimpleAvatarCreator';

export default function TestAvatarPage() {
  const [savedAvatar, setSavedAvatar] = useState<AvatarConfig | null>(null);
  const [showCreator, setShowCreator] = useState(true);

  const handleSave = (avatar: AvatarConfig) => {
    setSavedAvatar(avatar);
    setShowCreator(false);
    console.log('Avatar saved:', avatar);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          🎨 Test Avatar Builder
        </h1>

        {showCreator ? (
          <SimpleAvatarCreator
            initialAvatar={savedAvatar || DEFAULT_AVATAR}
            onSave={handleSave}
            onCancel={() => setShowCreator(false)}
          />
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
            <h2 className="text-xl font-semibold mb-6">Tvůj avatar:</h2>
            
            <div className="flex justify-center mb-6">
              <AvatarDisplay avatar={savedAvatar || DEFAULT_AVATAR} size={200} />
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setShowCreator(true)}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
              >
                Upravit avatar
              </button>
              
              <button
                onClick={() => {
                  setSavedAvatar(null);
                  setShowCreator(true);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                Vytvořit nový
              </button>
            </div>

            {savedAvatar && (
              <div className="mt-8 p-4 bg-gray-50 rounded-xl text-left">
                <h3 className="font-medium mb-2">Avatar config:</h3>
                <pre className="text-xs text-gray-600 overflow-auto">
                  {JSON.stringify(savedAvatar, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}











