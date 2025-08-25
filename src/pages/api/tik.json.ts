import type { APIRoute } from 'astro';
import axios from 'axios';

// Delay function to enforce rate limit (1 request/second)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function resolveTikTokUrl(tiktokUrl: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 5;
  const startTime = Date.now();

  while (attempts < maxAttempts) {
    try {
      console.log(`Resolving URL: ${tiktokUrl}, Attempt: ${attempts + 1}`);
      await delay(1500); // Enforce 1.5s delay to respect 1 req/s limit
      const response = await axios.get('https://tikwm.com/api', {
        params: { url: encodeURIComponent(tiktokUrl), hd: 1 },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
        timeout: 30000, // 30 seconds timeout
      });
      console.log(`Resolved URL in ${Date.now() - startTime}ms, Response code: ${response.data.code}`);
      if (response.data.code === 0 && response.data.data) {
        const { author, id } = response.data.data;
        const canonicalUrl = `https://www.tiktok.com/@${author.unique_id}/video/${id}`;
        console.log(`Canonical URL: ${canonicalUrl}`);
        return canonicalUrl;
      }
      throw new Error('Could not resolve TikTok URL');
    } catch (error: any) {
      console.error(`Error resolving TikTok URL: ${error.message}, Status: ${error.response?.status}, Attempt: ${attempts + 1}`);
      if (error.response?.status === 429 || error.response?.status === 500 || error.code === 'ECONNABORTED') {
        if (error.response?.data?.detail?.includes('Free Api Limit')) {
          console.log('Rate limit detected: Free Api Limit: 1 request/second');
        }
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`Rate limit or timeout exceeded after ${maxAttempts} attempts`);
        }
        await delay(2000); // Wait 2 seconds before retry
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
    const startTime = Date.now();
    console.log(`Processing URL: ${tiktokUrl}`);
    const canonicalUrl = await resolveTikTokUrl(tiktokUrl);
    console.log(`Total resolution time: ${Date.now() - startTime}ms`);

    // Check for action query parameter (e.g., ?action=download or ?action=preview)
    const action = url.searchParams.get('action');

    if (action === 'download') {
      const downloadStartTime = Date.now();
      await delay(1500); // Enforce 1.5s delay
      // Fetch metadata to get the play URL
      const metadataResponse = await axios.get('https://tikwm.com/api', {
        params: {
          url: encodeURIComponent(canonicalUrl),
          hd: 1,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 30000,
      });

      const metadata = metadataResponse.data;
      console.log(`Metadata fetch time: ${Date.now() - downloadStartTime}ms`);

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

      await delay(1500); // Enforce 1.5s delay
      // Fetch the video file as arraybuffer
      const videoResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'video/mp4',
          'Referer': 'https://tikwm.com',
        },
        timeout: 60000,
      });

      const contentLength = videoResponse.headers['content-length'] || 'unknown';
      console.log(`Video fetch time: ${Date.now() - downloadStartTime}ms, Content-Length: ${contentLength}, Data length: ${videoResponse.data.byteLength}`);

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
      const previewStartTime = Date.now();
      await delay(1500); // Enforce 1.5s delay
      const metadata = await axios.get('https://tikwm.com/api', {
        params: { url: encodeURIComponent(canonicalUrl), hd: 1 },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 30000,
      });
      console.log(`Preview metadata fetch time: ${Date.now() - previewStartTime}ms`);

      if (metadata.data.code !== 0) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch video metadata' }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      await delay(1500); // Enforce 1.5s delay
      const videoResponse = await axios.get(metadata.data.data.play, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://tikwm.com' },
        timeout: 60000,
      });
      console.log(`Preview video fetch time: ${Date.now() - previewStartTime}ms, Data length: ${videoResponse.data.byteLength}`);

      return new Response(videoResponse.data, {
        status: 200,
        headers: { 'Content-Type': 'video/mp4', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Default action: Fetch metadata
    const metadataStartTime = Date.now();
    await delay(1500); // Enforce 1.5s delay
    const response = await axios.get('https://tikwm.com/api', {
      params: {
        url: encodeURIComponent(canonicalUrl),
        hd: 1,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 30000,
    });
    console.log(`Metadata fetch time: ${Date.now() - metadataStartTime}ms`);

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
    if (error.response?.status === 429 || (error.response?.status === 500 && error.response?.data?.detail?.includes('Free Api Limit'))) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded, please try again later', detail: error.response?.data?.detail || error.message }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    return new Response(
      JSON.stringify({ error: 'Server Error', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
