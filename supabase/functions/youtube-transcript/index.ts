import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Extrahuje video ID z YouTube URL
 */
function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Získá titulky z YouTube videa
 */
async function getYouTubeTranscript(videoId: string): Promise<{ success: boolean; transcript?: string; error?: string }> {
  console.log('[YouTubeTranscript] Fetching transcript for:', videoId);
  
  try {
    // 1. Načíst stránku videa pro získání caption tracks
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'cs,en;q=0.9',
      }
    });
    
    if (!pageResponse.ok) {
      throw new Error('Nepodařilo se načíst stránku videa');
    }
    
    const pageHtml = await pageResponse.text();
    
    // 2. Extrahovat caption tracks z HTML
    const captionMatch = pageHtml.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionMatch) {
      // Zkusit alternativní pattern
      const altMatch = pageHtml.match(/\\"captionTracks\\":\s*(\[.*?\])/);
      if (!altMatch) {
        console.log('[YouTubeTranscript] No captions found in page');
        return { success: false, error: 'Video nemá dostupné titulky' };
      }
    }
    
    let captionTracks: any[] = [];
    try {
      // Parse caption tracks JSON
      const captionJson = captionMatch?.[1] || '';
      captionTracks = JSON.parse(captionJson.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
    } catch (e) {
      // Zkusit jiný způsob extrakce
      const timedTextMatch = pageHtml.match(/playerCaptionsTracklistRenderer.*?captionTracks.*?\[(.*?)\]/s);
      if (timedTextMatch) {
        try {
          captionTracks = JSON.parse(`[${timedTextMatch[1]}]`);
        } catch {
          console.log('[YouTubeTranscript] Failed to parse caption tracks');
        }
      }
    }
    
    if (captionTracks.length === 0) {
      // Zkusit přímé API pro automatické titulky
      const autoTranscriptUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`;
      const autoResponse = await fetch(autoTranscriptUrl);
      
      if (autoResponse.ok) {
        const autoData = await autoResponse.json();
        if (autoData.events && autoData.events.length > 0) {
          const transcript = autoData.events
            .filter((e: any) => e.segs)
            .map((e: any) => e.segs.map((s: any) => s.utf8).join(''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (transcript.length > 50) {
            return { success: true, transcript };
          }
        }
      }
      
      return { success: false, error: 'Video nemá dostupné titulky' };
    }
    
    // 3. Preferovat české titulky, pak anglické, pak jakékoliv
    let captionUrl = '';
    const csTrack = captionTracks.find((t: any) => t.languageCode === 'cs');
    const enTrack = captionTracks.find((t: any) => t.languageCode === 'en');
    const anyTrack = captionTracks[0];
    
    const selectedTrack = csTrack || enTrack || anyTrack;
    if (selectedTrack?.baseUrl) {
      captionUrl = selectedTrack.baseUrl;
    }
    
    if (!captionUrl) {
      return { success: false, error: 'Nepodařilo se najít URL titulků' };
    }
    
    // 4. Stáhnout titulky
    console.log('[YouTubeTranscript] Fetching captions from:', captionUrl.substring(0, 100));
    const captionResponse = await fetch(captionUrl + '&fmt=json3');
    
    if (!captionResponse.ok) {
      throw new Error('Nepodařilo se stáhnout titulky');
    }
    
    const captionData = await captionResponse.json();
    
    // 5. Extrahovat text z titulků
    if (captionData.events && Array.isArray(captionData.events)) {
      const transcript = captionData.events
        .filter((event: any) => event.segs)
        .map((event: any) => {
          return event.segs
            .map((seg: any) => seg.utf8 || '')
            .join('');
        })
        .join(' ')
        .replace(/\[.*?\]/g, '') // Odstranit [Music] atd.
        .replace(/\s+/g, ' ')
        .trim();
      
      if (transcript.length > 50) {
        console.log('[YouTubeTranscript] Got transcript, length:', transcript.length);
        return { success: true, transcript };
      }
    }
    
    return { success: false, error: 'Nepodařilo se extrahovat text z titulků' };
    
  } catch (error) {
    console.error('[YouTubeTranscript] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Neznámá chyba' 
    };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { videoUrl, videoId: providedVideoId } = await req.json();
    
    const videoId = providedVideoId || extractVideoId(videoUrl);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatná YouTube URL' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    const result = await getYouTubeTranscript(videoId);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error('[YouTubeTranscript] Handler error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Chyba serveru' 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
