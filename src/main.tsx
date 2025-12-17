import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import 'katex/dist/katex.min.css';
import { setOpenAIKey } from "./utils/openai-chat.ts";

// Initialize OpenAI API key from URL parameter (one-time setup) or localStorage
const urlParams = new URLSearchParams(window.location.search);
const apiKeyParam = urlParams.get('openai_key');
if (apiKeyParam) {
  setOpenAIKey(apiKeyParam);
  // Remove key from URL for security
  urlParams.delete('openai_key');
  const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);
  console.log('OpenAI API key set from URL parameter');
}

// Load Cooper Light font using Font Loading API
const cooperFont = new FontFace(
  'Cooper Light',
  'url(https://jjpiguuubvmiobmixwgh.supabase.co/storage/v1/object/public/Admin%20math/Cooper-Light.otf)',
  { weight: 'normal', style: 'normal' }
);

cooperFont.load().then((loadedFont) => {
  document.fonts.add(loadedFont);
  console.log('Cooper Light font loaded successfully');
}).catch((error) => {
  console.error('Failed to load Cooper Light font:', error);
});

createRoot(document.getElementById("root")!).render(<App />);
  