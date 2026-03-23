/**
 * Imagen Generate Edge Function
 * 
 * Generates images using Nano Banana Pro 3 (gemini-3-pro-image-preview).
 * https://ai.google.dev/gemini-api/docs/image-generation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImagenRequest {
  prompt: string;
  aspectRatio?: string;
  numberOfImages?: number;
  dataSetId?: string;
  illustrationName?: string;
  /** Public HTTPS URL of the reference image (preferred over base64). */
  referenceImageUrl?: string;
  /** Fallback: base64 of the original image (no data: prefix). */
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  /**
   * Výběr modelu:
   *   'pro'   → gemini-3-pro-image-preview   (~$0.13/obr, nejvyšší kvalita)
   *   'flash' → gemini-3.1-flash-image-preview (~$0.015/obr, rychlý)
   * Výchozí: 'flash'
   */
  model?: 'pro' | 'flash';
  /**
   * Explicitní rozlišení výstupu (pouze text-to-image, bez reference image):
   *   '512px' → 512×512 px
   *   '1K'    → 1024×1024 px (default)
   *   '2K'    → 2048×2048 px
   *   '4K'    → 4096×4096 px
   */
  imageSize?: '512px' | '1K' | '2K' | '4K';
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, aspectRatio = "1:1", dataSetId, referenceImageUrl, referenceImageBase64, referenceImageMimeType, model = 'flash', imageSize }: ImagenRequest = await req.json();

    const apiKey = Deno.env.get("GEMINI_API_KEY_RAG");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY_RAG not configured");
    }

    // Výběr modelu podle parametru
    const geminiModel = model === 'flash'
      ? 'gemini-3.1-flash-image-preview'   // ~$0.015/obr, rychlý
      : 'gemini-3-pro-image-preview';       // ~$0.13/obr, nejvyšší kvalita

    const modelLabel = model === 'flash' ? 'Nano Banana Flash 3.1' : 'Nano Banana Pro 3';

    console.log(`[${modelLabel}] Generating image with ${geminiModel}...`);
    console.log(`[${modelLabel}] Prompt:`, prompt.substring(0, 200) + "...");
    console.log(`[${modelLabel}] Reference image URL:`, referenceImageUrl || "(none)");

    // If a reference image URL is provided, fetch it server-side and convert to base64.
    // fileData.fileUri only works for gs:// or Files API URIs — not plain HTTPS URLs.
    let refBase64 = referenceImageBase64;
    let refMime = referenceImageMimeType || "image/jpeg";
    if (referenceImageUrl && !refBase64) {
      try {
        console.log("[Nano Banana Pro 3] Fetching reference image from URL...");
        const imgRes = await fetch(referenceImageUrl);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          // Safe base64 encoding for large images (avoids btoa stack overflow)
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }
          refBase64 = btoa(binary);
          refMime = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
          console.log("[Nano Banana Pro 3] Reference image fetched OK — size:", bytes.length, "mime:", refMime, "b64 length:", refBase64.length);
        } else {
          console.warn("[Nano Banana Pro 3] Failed to fetch reference image:", imgRes.status);
        }
      } catch (e) {
        console.warn("[Nano Banana Pro 3] Error fetching reference image:", e);
      }
    }

    const hasReferenceImage = !!refBase64;

    // Build generationConfig:
    // - With reference image (editing): use responseModalities (imageConfig breaks editing)
    // - Without (text-to-image): use imageConfig.aspectRatio for aspect ratio control
    // text-to-image: keep original imageConfig (works in curriculum factory)
    // image-editing: use responseModalities only (imageConfig breaks editing mode)
    const imageConfig: Record<string, string> = { aspectRatio };
    if (imageSize && !hasReferenceImage) {
      imageConfig.imageSize = imageSize;
    }

    const generationConfig = hasReferenceImage
      ? { responseModalities: ["IMAGE"] }
      : { imageConfig };

    console.log(`[${modelLabel}] Mode:`, hasReferenceImage ? "image-editing" : "text-to-image");
    if (imageSize) console.log(`[${modelLabel}] Image size:`, imageSize);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              ...(refBase64 ? [{
                inlineData: {
                  mimeType: refMime,
                  data: refBase64,
                }
              }] : []),
              { text: prompt }
            ]
          }],
          generationConfig,
        }),
      }
    );

    const responseText = await response.text();
    console.log("[Nano Banana Pro 3] Response status:", response.status);

    if (!response.ok) {
      console.error("[Nano Banana Pro 3] Error response:", responseText);
      throw new Error(`API error: ${responseText.substring(0, 300)}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
    }

    // Hledat obrázek v odpovědi (inlineData)
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.error(`[${modelLabel}] No image in response:`, JSON.stringify(data).substring(0, 500));
      throw new Error("No image data in response");
    }

    const base64Image = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    console.log(`[${modelLabel}] Successfully generated image!`);

    // VŽDY nahrajeme do Supabase Storage — nikdy nevracíme base64 v response!
    // Base64 v response = velký payload, a klient by ho mohl omylem uložit do DB.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const folder = dataSetId ? dataSetId : "misc";
    const fileName = `${folder}/${crypto.randomUUID()}.png`;
    const binaryData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(fileName, binaryData, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("[Nano Banana Pro 3] Storage upload error:", uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from("generated-images").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;
    console.log(`[${modelLabel}] Uploaded to storage:`, publicUrl);

    // Vracíme POUZE URL — žádný base64!
    return new Response(
      JSON.stringify({ 
        success: true, 
        url: publicUrl,
        // images pole záměrně vynecháno — nikdy nevracet base64
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[imagen-generate] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
