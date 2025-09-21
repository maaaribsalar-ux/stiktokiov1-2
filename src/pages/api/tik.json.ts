import type { APIRoute } from "astro";

// Import the TikTok API library using ES modules syntax
import TikTok from "@tobyg74/tiktok-api-dl";

// Define TypeScript interfaces for TikTok API responses based on tiktok-api-dl documentation
interface TiktokAPIResponse {
  status: "success" | "error";
  message?: string;
  result?: {
    type: "video" | "image";
    id: string;
    createTime: number;
    desc: string;
    author: {
      uid: number;
      username: string;
      nickname: string;
      avatarThumb: string[];
      avatarMedium: string[];
    };
    video?: {
      downloadAddr: string[];
      playAddr: string[];
    };
    images?: string[];
    music: {
      playUrl: string[];
    };
  };
}

interface SSSTikResponse {
  status: "success" | "error";
  message?: string;
  result?: {
    type: "image" | "video" | "music";
    desc?: string;
    author?: {
      avatar: string;
      nickname: string;
    };
    video?: {
      playAddr: string;
    };
    images?: string[];
    music?: {
      playUrl: string;
    };
  };
}

interface MusicalDownResponse {
  status: "success" | "error";
  message?: string;
  result?: {
    type: "video" | "image";
    desc?: string;
    author?: {
      avatar?: string;
      nickname?: string;
    };
    videoHD?: string;
    videoWatermark?: string;
    images?: string[];
    music?: string;
  };
}

// Union type for all possible responses
type TikTokResponse = TiktokAPIResponse | SSSTikResponse | MusicalDownResponse;

// Function to resolve short URLs
async function resolveShortUrl(url: string): Promise<string> {
  try {
    console.log("Resolving short URL:", url);
    
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    const resolvedUrl = response.url;
    console.log("Resolved to:", resolvedUrl);
    return resolvedUrl;
  } catch (error: any) {
    console.log("URL resolution failed:", error.message);
    return url; // Return original if resolution fails
  }
}

// Transform the library response to match your existing frontend format
function transformLibraryResponse(libraryData: TikTokResponse) {
  const result = libraryData.result;
  if (!result) return null;

  // Handle different response structures based on version
  const isV1 = 'id' in result && 'createTime' in result;
  const isV2 = 'type' in result && result.type === ('image' || 'video' || 'music');
  const isV3 = 'videoHD' in result || 'videoWatermark' in result;

  return {
    status: "success",
    result: {
      type: result.type || (result.images ? "image" : "video"),
      author: {
        avatar: isV1
          ? (result as TiktokAPIResponse['result'])?.author?.avatarThumb?.[0] || (result as TiktokAPIResponse['result'])?.author?.avatarMedium?.[0] || null
          : isV2
          ? (result as SSSTikResponse['result'])?.author?.avatar || null
          : (result as MusicalDownResponse['result'])?.author?.avatar || null,
        nickname: isV1
          ? (result as TiktokAPIResponse['result'])?.author?.nickname || (result as TiktokAPIResponse['result'])?.author?.username || "Unknown Author"
          : isV2
          ? (result as SSSTikResponse['result'])?.author?.nickname || "Unknown Author"
          : (result as MusicalDownResponse['result'])?.author?.nickname || "Unknown Author",
      },
      desc: result.desc || "No description available",
      videoSD: isV1
        ? (result as TiktokAPIResponse['result'])?.video?.downloadAddr?.[0] || (result as TiktokAPIResponse['result'])?.video?.playAddr?.[0] || null
        : isV2
        ? (result as SSSTikResponse['result'])?.video?.playAddr || null
        : (result as MusicalDownResponse['result'])?.videoWatermark || null,
      videoHD: isV1
        ? (result as TiktokAPIResponse['result'])?.video?.downloadAddr?.[1] || (result as TiktokAPIResponse['result'])?.video?.downloadAddr?.[0] || (result as TiktokAPIResponse['result'])?.video?.playAddr?.[1] || (result as TiktokAPIResponse['result'])?.video?.playAddr?.[0] || null
        : isV2
        ? (result as SSSTikResponse['result'])?.video?.playAddr || null
        : (result as MusicalDownResponse['result'])?.videoHD || (result as MusicalDownResponse['result'])?.videoWatermark || null,
      video_hd: isV1
        ? (result as TiktokAPIResponse['result'])?.video?.downloadAddr?.[0] || (result as TiktokAPIResponse['result'])?.video?.playAddr?.[0] || null
        : isV2
        ? (result as SSSTikResponse['result'])?.video?.playAddr || null
        : (result as MusicalDownResponse['result'])?.videoHD || null,
      videoWatermark: isV1
        ? (result as TiktokAPIResponse['result'])?.video?.playAddr?.[0] || null
        : isV2
        ? (result as SSSTikResponse['result'])?.video?.playAddr || null
        : (result as MusicalDownResponse['result'])?.videoWatermark || null,
      music: isV1
        ? (result as TiktokAPIResponse['result'])?.music?.playUrl?.[0] || null
        : isV2
        ? (result as SSSTikResponse['result'])?.music?.playUrl || null
        : (result as MusicalDownResponse['result'])?.music || null,
      uploadDate: isV1
        ? (result as TiktokAPIResponse['result'])?.createTime ? new Date((result as TiktokAPIResponse['result']).createTime * 1000).toISOString() : null
        : null, // V2 and V3 may not provide createTime
      images: result.images || null,
    },
  };
}

// Try multiple versions of the downloader API
async function tryLibraryDownloader(url: string): Promise<any> {
  const versions = ["v1", "v2", "v3"];
  let lastError: Error | null = null;

  for (const version of versions) {
    try {
      console.log(`Trying TikTok library downloader version ${version}...`);
      
      const result = await TikTok.Downloader(url, {
        version: version as "v1" | "v2" | "v3",
        showOriginalResponse: false,
      });

      console.log(`Library ${version} response:`, result);

      if (result.status === "success" && result.result) {
        const transformedData = transformLibraryResponse(result);
        if (transformedData && transformedData.result) {
          console.log(`Success with library version ${version}`);
          return transformedData;
        }
      }
      
      throw new Error(result.message || `Library version ${version} returned no data`);
      
    } catch (error: any) {
      console.log(`Library version ${version} failed:`, error.message);
      lastError = error;
      
      // Add delay between attempts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  throw lastError || new Error("All library downloader versions failed");
}

// Fallback to external services if library fails
async function fallbackToExternalServices(url: string): Promise<any> {
  const services = [
    {
      name: 'TikWM',
      url: `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
      transform: (data: any) => ({
        status: "success",
        result: {
          type: data.data?.images ? "image" : "video",
          author: {
            avatar: data.data?.author?.avatar || null,
            nickname: data.data?.author?.unique_id || data.data?.author?.nickname || "Unknown Author",
          },
          desc: data.data?.title || "No description available",
          videoSD: data.data?.play || null,
          videoHD: data.data?.hdplay || data.data?.play || null,
          video_hd: data.data?.hdplay || null,
          videoWatermark: data.data?.wmplay || null,
          music: data.data?.music || null,
          uploadDate: data.data?.create_time ? new Date(data.data.create_time * 1000).toISOString() : null,
          images: data.data?.images || null,
        },
      }),
    },
  ];

  for (const service of services) {
    try {
      console.log(`Trying fallback service: ${service.name}`);
      
      const response = await fetch(service.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (service.name === 'TikWM' && data.code === 0 && data.data) {
        return service.transform(data);
      }
      
    } catch (error: any) {
      console.log(`${service.name} fallback failed:`, error.message);
    }
  }

  throw new Error("All fallback services also failed");
}

export const GET: APIRoute = async (context) => {
  try {
    console.log("=== TikTok API Request (Library Version) ===");
    
    const url = context.url.searchParams.get("url");
    
    console.log("Requested URL:", url);
    
    // Handle download request
    if (!url) {
      return new Response(JSON.stringify({
        error: "URL parameter is required",
        status: "error",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Validate TikTok URL
    if (!url.includes("tiktok.com") && !url.includes("douyin")) {
      return new Response(JSON.stringify({
        error: "Invalid URL. Please provide a valid TikTok URL.",
        status: "error",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // First resolve short URLs
    let processedUrl = url;
    if (url.includes('/t/') || url.includes('vm.tiktok.com')) {
      processedUrl = await resolveShortUrl(url);
    }
    
    console.log("Starting download with library...");
    
    let data;
    try {
      // First try the official library
      data = await tryLibraryDownloader(processedUrl);
    } catch (libraryError: any) {
      console.log("Library failed, trying fallback services...");
      console.log("Library error:", libraryError.message);
      
      try {
        // Fallback to external services if library completely fails
        data = await fallbackToExternalServices(processedUrl);
        console.log("Fallback service succeeded");
      } catch (fallbackError: any) {
        console.log("All services failed");
        throw libraryError; // Throw original library error
      }
    }
    
    // Validate result
    if (!data || !data.result) {
      throw new Error("No data returned from any service");
    }
    
    // Check for downloadable content
    const hasVideo = data.result.videoSD || data.result.videoHD || data.result.video_hd || data.result.videoWatermark;
    const hasAudio = data.result.music;
    const hasImages = data.result.images;
    
    if (!hasVideo && !hasAudio && !hasImages) {
      return new Response(JSON.stringify({
        error: "This video appears to be private, deleted, or not available for download.",
        status: "error",
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    console.log("Success! Returning data...");
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
    
  } catch (error: any) {
    console.error("=== Final Error ===", error);
    
    let errorMessage = "Unable to process TikTok video.";
    let statusCode = 500;
    
    if (error.message.includes("403")) {
      errorMessage = "TikTok is currently blocking requests. Please try again later.";
      statusCode = 403;
    } else if (error.message.includes("404")) {
      errorMessage = "Video not found. It may be private, deleted, or the URL is incorrect.";
      statusCode = 404;
    } else if (error.message.includes("timeout")) {
      errorMessage = "Request timed out. The service may be temporarily unavailable.";
      statusCode = 408;
    } else if (error.message.includes("private") || error.message.includes("deleted")) {
      errorMessage = "This video is private or has been deleted.";
      statusCode = 404;
    }
    
    return new Response(JSON.stringify({
      error: errorMessage,
      status: "error",
      details: error.message,
      timestamp: new Date().toISOString(),
    }), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
};
