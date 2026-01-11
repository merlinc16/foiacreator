import { NextRequest, NextResponse } from "next/server";
import { AgencyComponent } from "@/lib/types";
import agencyEmails from "@/data/agency-emails.json";

const FOIA_API_BASE = "https://api.foia.gov/api";

// Cache all agencies in memory (refreshed every 24 hours)
let cachedAgencies: AgencyComponent[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Set of agency component IDs that have email addresses
const agenciesWithEmail = new Set(
  agencyEmails
    .filter((a: { email: string }) => a.email && a.email.length > 0)
    .map((a: { componentId: string }) => a.componentId)
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search");
  const id = searchParams.get("id");

  try {
    const headers: HeadersInit = {
      "X-API-Key": process.env.FOIA_API_KEY || "",
      Accept: "application/json",
    };

    if (id) {
      // Fetch specific agency component
      const response = await fetch(
        `${FOIA_API_BASE}/agency_components/${id}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`FOIA API error: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(transformComponent(data.data));
    }

    // Use cached agencies if available and not expired
    const now = Date.now();
    if (!cachedAgencies || now - cacheTime > CACHE_DURATION) {
      // Fetch all agencies (paginate to get all ~600)
      let allComponents: AgencyComponent[] = [];
      let page = 0;
      const pageSize = 50;

      while (true) {
        const url = `${FOIA_API_BASE}/agency_components?include=agency&page[limit]=${pageSize}&page[offset]=${page * pageSize}`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`FOIA API error: ${response.status}`);
        }

        const data = await response.json();
        const included = data.included || [];
        const components = data.data?.map((c: APIComponent) => transformComponent(c, included)) || [];

        allComponents = allComponents.concat(components);

        // Stop if we got fewer than pageSize (last page)
        if (components.length < pageSize) break;
        page++;

        // Safety limit
        if (page > 20) break;
      }

      cachedAgencies = allComponents;
      cacheTime = now;
    }

    // Only include agencies that have email addresses
    let results = cachedAgencies.filter((c: AgencyComponent) => agenciesWithEmail.has(c.id));

    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(
        (c: AgencyComponent) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.agency.name.toLowerCase().includes(searchLower) ||
          c.abbreviation?.toLowerCase().includes(searchLower) ||
          c.agency.abbreviation.toLowerCase().includes(searchLower)
      );
    }

    // Limit results
    return NextResponse.json(results.slice(0, 20));
  } catch (error) {
    console.error("Agencies error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agencies" },
      { status: 500 }
    );
  }
}

interface APIComponent {
  id: string;
  attributes?: {
    title?: string;
    abbreviation?: string;
    submission_address?: {
      address_lines?: string[];
      city?: string;
      state?: string;
      zip?: string;
    };
    emails?: string[];
    website?: {
      uri?: string;
    };
  };
  relationships?: {
    agency?: {
      data?: {
        id?: string;
      };
    };
  };
}

interface APIAgency {
  id: string;
  attributes?: {
    name?: string;
    abbreviation?: string;
  };
}

function transformComponent(component: APIComponent, included?: APIAgency[]): AgencyComponent {
  const attrs = component.attributes || {};
  const agencyId = component.relationships?.agency?.data?.id;

  // Find the parent agency from included data
  const parentAgency = included?.find((inc: APIAgency) => inc.id === agencyId);

  return {
    id: component.id,
    name: attrs.title || "Unknown",
    abbreviation: attrs.abbreviation,
    agency: {
      id: agencyId || "",
      name: parentAgency?.attributes?.name || attrs.title || "Unknown",
      abbreviation: parentAgency?.attributes?.abbreviation || attrs.abbreviation || "",
    },
    emails: attrs.emails || [],
    website: attrs.website ? { uri: attrs.website.uri || "" } : undefined,
    submission_address: attrs.submission_address,
  };
}
