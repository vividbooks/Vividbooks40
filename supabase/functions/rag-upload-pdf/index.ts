import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pdfUrl, title, subject, documentId } = await req.json();
    
    console.log('[RAG Upload] Starting upload:', title);
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY_RAG not configured');
    }

    // 1. Download PDF
    console.log('[RAG Upload] Fetching PDF:', pdfUrl);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }
    
    const pdfBlob = await pdfResponse.blob();
    const pdfBytes = await pdfBlob.arrayBuffer();
    console.log('[RAG Upload] PDF downloaded:', pdfBytes.byteLength, 'bytes');

    // 2. Initial Resumable Upload Request
    const uploadUrlResponse = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': pdfBytes.byteLength.toString(),
          'X-Goog-Upload-Header-Content-Type': 'application/pdf',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: {
            displayName: `${subject} - ${title}`,
          }
        })
      }
    );

    if (!uploadUrlResponse.ok) {
      const errorText = await uploadUrlResponse.text();
      console.error('[RAG Upload] Failed to get upload URL:', errorText);
      throw new Error(`Failed to get upload URL: ${uploadUrlResponse.statusText}`);
    }

    const uploadUrl = uploadUrlResponse.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) {
      throw new Error('No upload URL returned');
    }

    console.log('[RAG Upload] Got upload URL, uploading PDF...');

    // 3. Upload PDF content
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
        'Content-Type': 'application/pdf',
      },
      body: pdfBytes
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[RAG Upload] Upload failed:', errorText);
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.file?.name;
    
    if (!fileId) {
      throw new Error('No file ID returned');
    }

    console.log('[RAG Upload] PDF uploaded, file ID:', fileId);

    // 4. Wait for processing
    console.log('[RAG Upload] Waiting for processing...');
    let processed = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!processed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileId}?key=${GEMINI_API_KEY}`
      );
      
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        console.log('[RAG Upload] Processing status:', status.state);
        
        if (status.state === 'ACTIVE') {
          processed = true;
        } else if (status.state === 'FAILED') {
          throw new Error('File processing failed');
        }
      }
      attempts++;
    }

    if (!processed) {
      throw new Error('Processing timeout');
    }

    console.log('[RAG Upload] ✓ PDF processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        fileId: fileId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RAG Upload] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 even for errors so client can handle them
      }
    );
  }
});





