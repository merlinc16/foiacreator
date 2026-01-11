import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { RephraseResponse } from "@/lib/types";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey });
}

const SYSTEM_PROMPT = `You are an expert at crafting Freedom of Information Act (FOIA) requests. Your job is to take a user's informal query about what information they want from the government and transform it into a proper, legally-sound FOIA request.

When rephrasing a request, you should:
1. Use formal, precise legal language appropriate for FOIA requests
2. Clearly specify the types of records being requested (documents, emails, reports, memos, etc.)
3. Include reasonable date ranges when applicable
4. Be specific enough to be actionable but not so narrow as to miss relevant records
5. Reference the Freedom of Information Act, 5 U.S.C. § 552

Also identify which federal agency is most likely to hold these records. Common agencies include:
- Department of Defense (DOD)
- Federal Bureau of Investigation (FBI)
- Central Intelligence Agency (CIA)
- Department of Justice (DOJ)
- Department of State
- Department of Homeland Security (DHS)
- Environmental Protection Agency (EPA)
- National Security Agency (NSA)
- National Aeronautics and Space Administration (NASA)
- Department of Health and Human Services (HHS)
- Food and Drug Administration (FDA)
- Federal Communications Commission (FCC)
- Securities and Exchange Commission (SEC)

Respond in JSON format with these fields:
- rephrased: The formal FOIA request text
- suggestedAgency: The name of the agency most likely to have the records
- suggestedAgencyAbbreviation: The abbreviation (e.g., "FBI", "DOD")
- briefDescription: A short (under 10 words) description for the email subject line`;

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Please rephrase the following informal request into a proper FOIA request and identify the appropriate agency:\n\n"${query}"`,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Parse the JSON response from Claude
    // Try to find a valid JSON object by looking for balanced braces
    let jsonStr = "";
    let braceCount = 0;
    let startIndex = -1;

    for (let i = 0; i < content.text.length; i++) {
      if (content.text[i] === "{") {
        if (startIndex === -1) startIndex = i;
        braceCount++;
      } else if (content.text[i] === "}") {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          jsonStr = content.text.slice(startIndex, i + 1);
          break;
        }
      }
    }

    if (!jsonStr) {
      console.error("Could not find JSON in response:", content.text);
      throw new Error("Could not parse response");
    }

    let parsed;
    try {
      // Remove trailing commas before } which are invalid JSON
      const cleanedJson = jsonStr.replace(/,\s*}/g, "}");
      parsed = JSON.parse(cleanedJson);
    } catch (e) {
      console.error("Failed to parse JSON:", jsonStr);
      throw new Error("Invalid JSON in response");
    }

    const response: RephraseResponse = {
      original: query,
      rephrased: parsed.rephrased,
      suggestedAgency: parsed.suggestedAgency,
      suggestedAgencyId: parsed.suggestedAgencyAbbreviation,
      briefDescription: parsed.briefDescription,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Rephrase error:", error);
    return NextResponse.json(
      { error: "Failed to rephrase request" },
      { status: 500 }
    );
  }
}
