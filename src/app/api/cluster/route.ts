import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseUrls } from "@/lib/parse-urls";
import { filterJunk } from "@/lib/junk-filter";
import crypto from "crypto";

export const maxDuration = 120;

const MAX_TABS = 500;

function generateId(): string {
  return crypto.randomBytes(4).toString("hex");
}

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a tab organizer. Given a list of numbered browser tab URLs, group them into 3-8 meaningful clusters based on topic, purpose, or theme. Use URL structure (domains, path segments, query params) to infer what each tab is about.

Return valid JSON matching this exact schema:
{
  "clusters": [
    {
      "name": "Short descriptive name",
      "indices": [1, 5, 12]
    }
  ]
}

Rules:
- Use the line NUMBERS from the input to reference tabs (1-indexed)
- Every input number must appear in exactly one cluster
- Cluster names should be descriptive and human-friendly (e.g. "Bathroom Renovation Research", "Data Engineering Reading List", "Shopping")
- 3-8 clusters total. Merge small groups. Don't create clusters with only 1 item unless it's truly unique.
- Return ONLY the JSON object, no markdown fences, no explanation.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawInput: string = body.input;

    if (!rawInput || typeof rawInput !== "string") {
      return NextResponse.json({ error: "No input provided" }, { status: 400 });
    }

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

    // Send numbered URLs, truncated to reduce input tokens
    const urlList = kept.map((tab, i) => {
      const truncated = tab.url.length > 150 ? tab.url.slice(0, 150) + "..." : tab.url;
      return `${i + 1}. ${truncated}`;
    }).join("\n");

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
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

      let jsonStr = textBlock.text.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      let indexClusters;
      try {
        const result = JSON.parse(jsonStr);
        indexClusters = result.clusters;
      } catch (parseErr) {
        console.error("JSON parse failed. Raw response:", textBlock.text);
        return NextResponse.json(
          { error: "Clustering returned unparseable response. Please try again." },
          { status: 500 }
        );
      }

      if (!Array.isArray(indexClusters) || indexClusters.length === 0) {
        console.error("Invalid cluster format. Raw response:", textBlock.text);
        return NextResponse.json({ error: "Clustering returned invalid format" }, { status: 500 });
      }

      // Map indices back to full URLs with inferred titles
      const clusters = indexClusters.map((c: { name: string; indices: number[] }) => ({
        name: c.name,
        urls: (c.indices || [])
          .filter((idx: number) => idx >= 1 && idx <= kept.length)
          .map((idx: number) => {
            const tab = kept[idx - 1];
            // Infer a short title from URL
            const title = inferTitle(tab.url);
            return { url: tab.url, title };
          }),
      }));

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
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: `Clustering failed: ${msg}` }, { status: 500 });
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

function inferTitle(url: string): string {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, "");

    // Google searches: extract query
    if (domain.startsWith("google.") && u.pathname.includes("/search")) {
      const q = u.searchParams.get("q");
      if (q) return `Search: ${q.replace(/\+/g, " ")}`;
    }

    // Use path segments for a readable title
    const path = u.pathname
      .split("/")
      .filter(Boolean)
      .map(seg => seg.replace(/[-_]/g, " "))
      .join(" / ");

    if (path) {
      // Capitalize first letter
      const title = path.charAt(0).toUpperCase() + path.slice(1);
      return title.length > 60 ? title.slice(0, 57) + "..." : title;
    }

    return domain;
  } catch {
    return url;
  }
}
