import type { APIRoute } from "astro";
import { Downloader } from "@tobyg74/tiktok-api-dl";

export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  try {
    let url = new URL(request.url);
    let params = url.searchParams;
    let urlTik = params.get("url") || "";

    if (!urlTik) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    // Unshorten douyin links
    if (urlTik.includes("douyin")) {
      urlTik = await fetch(urlTik, {
        method: "HEAD",
        redirect: "follow",
      }).then((response) => {
        return response.url.replace("douyin", "tiktok");
      });
    }

    // Call the downloader
    let data = await Downloader(urlTik, {
      version: "v3",
    });

    // Force set type to 'story' if URL has '/story/'
    const isStory = urlTik.includes("/story/");
    if (isStory && data?.result) {
      data.result.type = "story";
    }

    // Add uploadDate if available
    const createTime = data?.result?.create_time;
    const uploadDate = createTime
      ? new Date(createTime * 1000).toISOString()
      : null;

    // Add uploadDate into the response object
    if (data?.result) {
      data.result.uploadDate = uploadDate;
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "content-type": "application/json",
      },
    });
  }
};
