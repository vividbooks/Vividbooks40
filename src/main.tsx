import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import 'katex/dist/katex.min.css';

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
  