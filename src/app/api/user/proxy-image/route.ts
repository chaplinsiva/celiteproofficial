import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get("url");

        if (!url) {
            return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
        }

        // Validate the URL starts with http:// or https://
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return NextResponse.json({ error: "Invalid URL scheme" }, { status: 400 });
        }

        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch remote image: ${response.statusText}` }, { status: response.status });
        }

        const contentType = response.headers.get("Content-Type") || "image/png";
        
        // Ensure we only proxy images
        if (!contentType.startsWith("image/")) {
            return NextResponse.json({ error: "URL does not point to an image" }, { status: 400 });
        }

        const arrayBuffer = await response.arrayBuffer();

        return new NextResponse(arrayBuffer, {
            headers: {
                "Content-Type": contentType,
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=31536000",
            },
        });
    } catch (error: any) {
        console.error("Proxy image error:", error);
        return NextResponse.json({ error: error.message || "Failed to proxy image" }, { status: 500 });
    }
}
