import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseUrls } from "@/lib/parse-urls";
import { filterJunk } from "@/lib/junk-filter";
import crypto from "crypto";

// Allow up to 120 seconds for the Claude API call
export const maxDuration = 120;

const MAX_TABS = 500;

function generateId(): string {
  return crypto.randomBytes(4).toString("hex");
}

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a tab organizer. Given a list of browser tab URLs, group them into 3-8 meaningful clusters based on topic, purpose, or theme. Use URL structure (domains, path segments, query params) to infer what each tab is about.

Return valid JSON matching this exact schema:
{
  "clusters": [
    {
      "name": "Short descriptive name for this cluster",
      "urls": [
        { "url": "the original url", "title": "a short inferred title based on the URL" }
      ]
    }
  ]
}

Rules:
- Every input URL must appear in exactly one cluster
- Cluster names should be descriptive and human-friendly (e.g. "Bathroom Renovation Research", "Data Engineering Reading List", "Shopping")
- Infer short titles from URL structure (domain, path, query params). For example: "amazon.com/dp/B08..." -> "Amazon Product", "medium.com/@user/building-data-pipelines" -> "Building Data Pipelines"
- 3-8 clusters total. Merge small groups. Don't create clusters with only 1 item unless it's truly unique.
- Return ONLY the JSON object, no markdown fences, no explanation.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawInput: string = body.input;

    if (!rawInput || typeof rawInput !== "string") {
      return NextResponse.json({ error: "No input provided" }, { status: 400 });
    }

    // Parse and filter
    const parsed = parseUrls(rawInput);
    if (parsed.length === 0) {
      return NextResponse.json({ error: "No valid URLs found in your input" }, { status: 400 });
    }

    if (parsed.length > MAX_TABS) {
      return NextResponse.json(
        { error: `Too many tabs (${parsed.length}). Maximum is ${MAX_TABS}.` },
        { status: 400 }
      );
    }

    const { kept, filtered } = filterJunk(parsed);

    if (kept.length === 0) {
      return NextResponse.json(
        { error: "All URLs were filtered as junk (login pages, browser internals, etc.). Try pasting different tabs." },
        { status: 400 }
      );
    }

    // Truncate long URLs to reduce token count — keep domain + first 120 chars
    const urlList = kept.map((tab, i) => {
      const truncated = tab.url.length > 150 ? tab.url.slice(0, 150) + "..." : tab.url;
      return `${i + 1}. ${truncated}`;
    }).join("\n");

    // Call Claude API (single attempt, no retry to avoid doubling timeout)
    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `Here are ${kept.length} browser tab URLs to cluster:\n\n${urlList}`,
          },
        ],
        system: SYSTEM_PROMPT,
      });

      const textBlock = message.content.find(b => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json({ error: "No response from Claude" }, { status: 500 });
      }

      // Parse the JSON response, stripping markdown fences if present
      let jsonStr = textBlock.text.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const result = JSON.parse(jsonStr);
      const clusters = result.clusters;

      if (!Array.isArray(clusters) || clusters.length === 0) {
        return NextResponse.json({ error: "Clustering returned invalid format" }, { status: 500 });
      }

      // Restore full URLs in clusters (replace truncated versions with originals)
      for (const cluster of clusters) {
        for (const item of cluster.urls) {
          const match = kept.find(k => item.url.startsWith(k.url.slice(0, 100)) || k.url.startsWith(item.url.slice(0, 100)));
          if (match) {
            item.url = match.url;
          }
        }
      }

      // Generate shareable ID
      const id = generateId();

      return NextResponse.json({
        id,
        createdAt: new Date().toISOString(),
        stats: {
          total: parsed.length,
          kept: kept.length,
          filtered: filtered.length,
        },
        clusters,
        filtered,
      });
    } catch (err) {
      console.error("Clustering failed:", err instanceof Error ? err.message : err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: `Clustering failed: ${message}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
