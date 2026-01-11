import { NextRequest, NextResponse } from "next/server";
import { SubmitResponse, UserDetails, AgencyComponent } from "@/lib/types";
import Mailjet from "node-mailjet";
import * as fs from "fs";
import * as path from "path";

interface AgencyEmailData {
  name: string;
  abbreviation: string;
  parentAgency: string;
  email: string;
  website: string;
  foiaOfficer: string;
  address: string;
  phone: string;
  componentId: string;
}

// Load agency emails from scraped data
function loadAgencyEmails(): AgencyEmailData[] {
  try {
    const dataPath = path.join(process.cwd(), "src/data/agency-emails.json");
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading agency emails:", err);
  }
  return [];
}

// Find email for an agency
function findAgencyEmail(agencyId: string, agencyName: string): string | null {
  const agencies = loadAgencyEmails();

  // Try to match by component ID first
  const byId = agencies.find((a) => a.componentId === agencyId);
  if (byId && byId.email) {
    return byId.email;
  }

  // Try to match by name
  const byName = agencies.find(
    (a) => a.name.toLowerCase() === agencyName.toLowerCase()
  );
  if (byName && byName.email) {
    return byName.email;
  }

  // Try partial name match
  const partialMatch = agencies.find(
    (a) =>
      a.name.toLowerCase().includes(agencyName.toLowerCase()) ||
      agencyName.toLowerCase().includes(a.name.toLowerCase())
  );
  if (partialMatch && partialMatch.email) {
    return partialMatch.email;
  }

  return null;
}

// Get Mailjet client
function getMailjetClient(): Mailjet | null {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;

  if (!apiKey || !secretKey) {
    console.error("Mailjet credentials not set");
    return null;
  }

  return new Mailjet({ apiKey, apiSecret: secretKey });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      rephrasedRequest,
      briefDescription,
      agency,
      userDetails,
    }: {
      rephrasedRequest: string;
      briefDescription: string;
      agency: AgencyComponent;
      userDetails: UserDetails;
    } = body;

    // Validate required fields
    if (!rephrasedRequest || !agency || !userDetails) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("Processing FOIA submission for:", agency.name);

    // Find the agency's FOIA email
    const agencyEmail = findAgencyEmail(agency.id, agency.name);

    if (!agencyEmail) {
      return NextResponse.json<SubmitResponse>({
        success: false,
        message: `No email address found for ${agency.name}. Please submit your request manually at foia.gov.`,
      });
    }

    console.log("Found agency email:", agencyEmail);

    // Get Mailjet client
    const mailjet = getMailjetClient();
    if (!mailjet) {
      return NextResponse.json<SubmitResponse>({
        success: false,
        message: "Email service not configured. Please contact the administrator.",
      });
    }

    const fromEmail = process.env.MAILJET_FROM_EMAIL;
    const fromName = process.env.MAILJET_FROM_NAME || "FOIA Request";

    if (!fromEmail) {
      return NextResponse.json<SubmitResponse>({
        success: false,
        message: "Sender email not configured. Please contact the administrator.",
      });
    }

    // Build the FOIA request email
    const feeCategoryLabels: Record<string, string> = {
      commercial: "Commercial use requester",
      educational: "Educational institution",
      news_media: "Representative of the news media",
      other: "All other requesters",
    };

    const emailSubject = `FOIA Request - ${briefDescription}`;
    const emailBody = `Dear FOIA Officer,

Pursuant to the Freedom of Information Act, 5 U.S.C. § 552, I am requesting access to the following records:

${rephrasedRequest}

REQUESTER INFORMATION:
Name: ${userDetails.firstName} ${userDetails.lastName}
Email: ${userDetails.email}
${userDetails.phone ? `Phone: ${userDetails.phone}` : ""}
Address: ${userDetails.address.line1}${userDetails.address.line2 ? `, ${userDetails.address.line2}` : ""}, ${userDetails.address.city}, ${userDetails.address.state} ${userDetails.address.zip}

FEE CATEGORY:
${feeCategoryLabels[userDetails.feeCategory]}

FEE LIMITATION:
I am willing to pay up to $${userDetails.maxFee} for processing fees. If the estimated cost exceeds this amount, please contact me before proceeding.

${
  userDetails.feeWaiverRequested
    ? `FEE WAIVER REQUEST:
I am requesting a waiver of all fees associated with this request.
Justification: ${userDetails.feeWaiverReason || "Information will contribute significantly to public understanding."}`
    : ""
}

PREFERRED RESPONSE FORMAT:
I would prefer to receive records in electronic format (PDF or other common digital format) sent to my email address if possible.

Thank you for your consideration of this request. I look forward to your response within the statutory timeframe.

Sincerely,
${userDetails.firstName} ${userDetails.lastName}
${userDetails.email}
`;

    // Send the email via Mailjet
    try {
      const result = await mailjet.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: fromEmail,
              Name: fromName,
            },
            To: [
              {
                Email: agencyEmail,
              },
            ],
            ReplyTo: {
              Email: userDetails.email,
              Name: `${userDetails.firstName} ${userDetails.lastName}`,
            },
            Subject: emailSubject,
            TextPart: emailBody,
          },
        ],
      });

      console.log("Email sent successfully:", JSON.stringify(result.body));

      return NextResponse.json<SubmitResponse>({
        success: true,
        message: `Your FOIA request has been emailed to ${agency.name}! They will respond to ${userDetails.email}.`,
        trackingId: `FOIA-${Date.now()}`,
        emailSentTo: agencyEmail,
      });
    } catch (sendError: unknown) {
      console.error("Mailjet error:", sendError);

      const errorMessage =
        sendError instanceof Error ? sendError.message : "Unknown email error";

      return NextResponse.json<SubmitResponse>({
        success: false,
        message: `Failed to send email: ${errorMessage}. Please try again or submit manually at foia.gov.`,
      });
    }
  } catch (error) {
    console.error("Submit error:", error);

    return NextResponse.json<SubmitResponse>({
      success: false,
      message: `Submission failed: ${error instanceof Error ? error.message : "Unknown error"}. Please try submitting manually at foia.gov.`,
    });
  }
}
