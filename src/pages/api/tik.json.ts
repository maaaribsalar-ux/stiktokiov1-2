import type { APIRoute } from "astro";
import { Downloader } from "@tobyg74/tiktok-api-dl";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    console.log("=== ASTRO API DEBUG ===");
    console.log("1. Full context:", Object.keys(context));
    console.log("2. request.url:", context.request.url);
    console.log("3. url object:", context.url);

    // Try multiple ways to get URL parameters
    const requestUrl = context.request.url;
    const contextUrl = context.url;

    console.log("4. Trying URL parsing...");

    // Method 1: Parse request.url directly
    let urlTik = "";
    try {
      const parsedUrl = new URL(requestUrl);
      urlTik = parsedUrl.searchParams.get("url") || "";
      console.log("5. Method 1 (request.url):", urlTik);
    } catch (e) {
      console.log("5. Method 1 failed:", e.message);
    }

    // Method 2: Use context.url
    if (!urlTik && contextUrl) {
      try {
        urlTik = contextUrl.searchParams.get("url") || "";
        console.log("6. Method 2 (context.url):", urlTik);
      } catch (e) {
        console.log("6. Method 2 failed:", e.message);
      }
    }

    // Method 3: Parse manually from URL string
    if (!urlTik) {
      try {
        const urlMatch = requestUrl.match(/[?&]url=([^&]*)/);
        if (urlMatch) {
          urlTik = decodeURIComponent(urlMatch[1]);
          console.log("7. Method 3 (regex):", urlTik);
        }
      } catch (e) {
        console.log("7. Method 3 failed:", e.message);
      }
    }

    console.log("8. Final urlTik:", urlTik);

    if (!urlTik) {
      console.log("9. ERROR: No URL parameter found with any method");
      return new Response(
        JSON.stringify({
          status: "error",
          message: "url parameter is required",
          debug: {
            requestUrl: requestUrl,
            contextUrl: contextUrl ? contextUrl.href : null,
            contextSearch: contextUrl ? contextUrl.search : null,
            tried: ["new URL(request.url)", "context.url", "regex parsing"],
          },
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    // Validate TikTok URL format
    if (!urlTik.includes("tiktok.com") && !urlTik.includes("douyin")) {
      console.log("10. ERROR: Invalid TikTok URL format");
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Invalid TikTok URL format. Please provide a valid TikTok or Douyin URL.",
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    console.log("11. URL validation passed, calling TikTok API...");

    // Handle douyin URLs
    let processedUrl = urlTik;
    if (urlTik.includes("douyin")) {
      try {
        const response = await fetch(urlTik, {
          method: "HEAD",
          redirect: "follow",
        });
        processedUrl = response.url.replace("douyin", "tiktok");
        console.log("12. Processed douyin URL:", processedUrl);
      } catch (e) {
        console.error("Error processing douyin URL:", e);
      }
    }

    // Call the TikTok downloader with version 3
    console.log("13. Calling Downloader with URL:", processedUrl);
    const data = await Downloader(processedUrl, {
      version: "v3",
    });

    console.log("14. TikTok API response status:", data?.status);
    console.log("15. TikTok API response result:", data?.result);

    // Check if the response is successful
    if (!data || data.status === "error") {
      console.log("16. ERROR: TikTok API returned error");
      return new Response(
        JSON.stringify({
          status: "error",
          message: data?.message || "Failed to fetch video data from TikTok API",
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    // Validate response structure
    if (!data.result) {
      console.log("17. ERROR: No result data in response");
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Invalid response format - missing result data",
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    // Process the data to ensure it matches our interface
    const processedData = {
      status: data.status,
      message: data.message,
      result: {
        type: data.result.type || "video",
        desc: data.result.desc || "",
        author: data.result.author || {
          avatar: "",
          nickname: "Unknown User"
        },
        music: data.result.music || "",
        images: data.result.images || [],
        videoHD: data.result.videoHD || "",
        videoWatermark: data.result.videoWatermark || "",
        uploadDate: null
      }
    };

    // Handle story type detection
    const isStory = processedUrl.includes("/story/");
    if (isStory && processedData.result) {
      processedData.result.type = "story";
    }

    // Try to add upload date if available
    try {
      const createTime = (data.result as any)?.create_time;
      if (createTime) {
        const uploadDate = new Date(createTime * 1000).toISOString();
        processedData.result.uploadDate = uploadDate;
      }
    } catch (e) {
      console.log("Could not parse upload date:", e);
    }

    console.log("18. SUCCESS: Returning processed data");
    console.log("19. Processed data structure:", JSON.stringify(processedData, null, 2));
    
    return new Response(JSON.stringify(processedData), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      },
    });
  } catch (error: any) {
    console.error("=== API ERROR ===", error);
    return new Response(
      JSON.stringify({
        status: "error",
        message: error.message || "Internal server error",
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  }
};
