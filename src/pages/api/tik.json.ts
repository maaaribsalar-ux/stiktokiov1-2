import type { APIRoute } from 'astro';
import axios from 'axios';

async function resolveTikTokUrl(tiktokUrl: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.get('https://tikwm.com/api', {
        params: { url: encodeURIComponent(tiktokUrl), hd: 1 },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
      });
      if (response.data.code === 0 && response.data.data) {
        const { author, id } = response.data.data;
        return `https://www.tiktok.com/@${author.unique_id}/video/${id}`;
      }
      throw new Error('Could not resolve TikTok URL');
    } catch (error: any) {
      console.error('Error resolving TikTok URL:', error.message, error.response?.status);
      if (error.response?.status === 429) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Rate limit exceeded after multiple attempts');
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to resolve TikTok URL after retries');
}

export const POST: APIRoute = async ({ request, url }) => {
  try {
    // Parse the incoming request body (expects JSON with a 'url' field)
    const { url: tiktokUrl } = await request.json();

    if (!tiktokUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing TikTok video URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Resolve the URL to canonical format
    const canonicalUrl = await resolveTikTokUrl(tiktokUrl);

    // Check for action query parameter (e.g., ?action=download or ?action=preview)
    const action = url.searchParams.get('action');

    if (action === 'download') {
      // Fetch metadata to get the play URL
      const metadataResponse = await axios.get('https://tikwm.com/api', {
        params: {
          url: encodeURIComponent(canonicalUrl),
          hd: 1,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const metadata = metadataResponse.data;

      if (metadata.code !== 0) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch video metadata from TikWM', detail: metadata.msg }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      const videoUrl = metadata.data.play;
      if (!videoUrl) {
        return new Response(
          JSON.stringify({ error: 'No video URL found in metadata' }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      // Fetch the video file as arraybuffer
      const videoResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'video/mp4',
          'Referer': 'https://tikwm.com',
        },
      });

      const contentLength = videoResponse.headers['content-length'] || 'unknown';
      console.log(`Video response content-length: ${contentLength}, data length: ${videoResponse.data.byteLength}`);

      if (!videoResponse.data || videoResponse.data.byteLength === 0) {
        return new Response(
          JSON.stringify({ error: 'Empty video data received from TikWM' }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      // Return the video data
      return new Response(videoResponse.data, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="tiktok_video_${metadata.data.id}.mp4"`,
          'Access-Control-Allow-Origin': '*',
          'X-TikWM-Status': 'success',
          'X-Content-Length': contentLength,
        },
      });
    }

    if (action === 'preview') {
      const metadata = await axios.get('https://tikwm.com/api', {
        params: { url: encodeURIComponent(canonicalUrl), hd: 1 },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (metadata.data.code !== 0) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch video metadata' }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }
      const videoResponse = await axios.get(metadata.data.data.play, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://tikwm.com' },
      });
      return new Response(videoResponse.data, {
        status: 200,
        headers: { 'Content-Type': 'video/mp4', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Default action: Fetch metadata
    const response = await axios.get('https://tikwm.com/api', {
      params: {
        url: encodeURIComponent(canonicalUrl),
        hd: 1,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const data = response.data;

    if (data.code !== 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from TikWM', detail: data.msg }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Return metadata with both preview and download URLs
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: data.data.id,
          title: data.data.title,
          author: data.data.author.nickname,
          play: `/api/tik.json?action=download&tikTokUrl=${encodeURIComponent(canonicalUrl)}`,
          preview: `/api/tik.json?action=preview&tikTokUrl=${encodeURIComponent(canonicalUrl)}`,
          cover: data.data.cover,
          canonicalUrl,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error: any) {
    console.error('Error in TikTok API route:', error.message, error.response?.status, error.response?.data);
    if (error.response?.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    return new Response(
      JSON.stringify({ error: 'Server Error', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
