"use client";

import { useState } from "react";
import { UserDetails, AgencyComponent } from "@/lib/types";

interface SubmitStepProps {
  rephrasedRequest: string;
  briefDescription: string;
  agency: AgencyComponent;
  userDetails: UserDetails;
  onBack: () => void;
  onReset: () => void;
}

// Agency emails data - loaded from our scraped data
import agencyEmails from "@/data/agency-emails.json";

function findAgencyEmail(agencyId: string, agencyName: string): string | null {
  // Try to match by component ID first
  const byId = agencyEmails.find((a: { componentId: string; email: string }) => a.componentId === agencyId);
  if (byId && byId.email) {
    return byId.email;
  }

  // Try to match by name
  const byName = agencyEmails.find(
    (a: { name: string; email: string }) => a.name.toLowerCase() === agencyName.toLowerCase()
  );
  if (byName && byName.email) {
    return byName.email;
  }

  // Try partial name match
  const partialMatch = agencyEmails.find(
    (a: { name: string; email: string }) =>
      a.name.toLowerCase().includes(agencyName.toLowerCase()) ||
      agencyName.toLowerCase().includes(a.name.toLowerCase())
  );
  if (partialMatch && partialMatch.email) {
    return partialMatch.email;
  }

  return null;
}

export default function SubmitStep({
  rephrasedRequest,
  briefDescription,
  agency,
  userDetails,
  onBack,
  onReset,
}: SubmitStepProps) {
  const [submitted, setSubmitted] = useState(false);
  const [isFillingPortal, setIsFillingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const agencyEmail = findAgencyEmail(agency.id, agency.name);

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

  const handleSubmit = async () => {
    if (!agencyEmail) {
      // Use Playwright to fill the portal form automatically
      setIsFillingPortal(true);
      setPortalError(null);

      try {
        const response = await fetch("/api/fill-portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agencyId: agency.id,
            firstName: userDetails.firstName,
            lastName: userDetails.lastName,
            email: userDetails.email,
            phone: userDetails.phone,
            addressLine1: userDetails.address.line1,
            addressLine2: userDetails.address.line2,
            city: userDetails.address.city,
            state: userDetails.address.state,
            zip: userDetails.address.zip,
            requestDescription: rephrasedRequest,
            feeWaiverRequested: userDetails.feeWaiverRequested,
            feeWaiverReason: userDetails.feeWaiverReason,
            maxFee: userDetails.maxFee,
            feeCategory: userDetails.feeCategory,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setSubmitted(true);
        } else {
          setPortalError(result.error || "Failed to open portal");
        }
      } catch (e) {
        console.error("Portal fill error:", e);
        setPortalError("Failed to connect to the portal service");
      } finally {
        setIsFillingPortal(false);
      }
      return;
    }

    // Create Gmail compose URL
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(agencyEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    // Open Gmail in new tab
    window.open(gmailUrl, '_blank');

    // Mark as submitted
    setSubmitted(true);
  };

  // Format all info for easy copy-paste into portal
  const allFieldsText = `First Name: ${userDetails.firstName}
Last Name: ${userDetails.lastName}
Email: ${userDetails.email}
${userDetails.phone ? `Phone: ${userDetails.phone}` : ''}
Address: ${userDetails.address.line1}
${userDetails.address.line2 ? `Address Line 2: ${userDetails.address.line2}` : ''}
City: ${userDetails.address.city}
State: ${userDetails.address.state}
ZIP: ${userDetails.address.zip}

Request Description:
${rephrasedRequest}`.trim();

  // Success state
  if (submitted) {
    // Portal submission success
    if (!agencyEmail) {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-900/50">
            <svg
              className="h-8 w-8 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Form Pre-Filled!</h2>
            <p className="mt-2 text-gray-400">
              A browser window has opened with your FOIA request form already filled in.
              Just complete the CAPTCHA and click Submit!
            </p>
          </div>

          <div className="rounded-lg bg-gray-700 p-4 text-left">
            <h3 className="font-medium text-white mb-2">Next steps:</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">1.</span>
                Find the browser window that opened
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">2.</span>
                Complete the CAPTCHA verification
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">3.</span>
                Click the Submit button on the portal
              </li>
            </ul>
          </div>

          <button
            onClick={onReset}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Submit Another Request
          </button>
        </div>
      );
    }

    // Gmail submission success
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-900/50">
          <svg
            className="h-8 w-8 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Gmail Opened!</h2>
          <p className="mt-2 text-gray-400">
            Gmail should have opened in a new tab with your FOIA request ready to send.
            Just click Send in Gmail!
          </p>
        </div>

        <div className="rounded-lg bg-gray-700 p-4 text-left">
          <h3 className="font-medium text-white">What happens next?</h3>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-400">1.</span>
              Click Send in Gmail to submit the request.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">2.</span>
              The agency will acknowledge your request within a few days.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">3.</span>
              They have 20 business days to respond (though complex requests may
              take longer).
            </li>
          </ul>
        </div>

        <p className="text-sm text-gray-400">
          Email will be sent to: {agencyEmail}
        </p>

        <button
          onClick={onReset}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Submit Another Request
        </button>
      </div>
    );
  }

  // Portal submission state (agency without email)
  if (!agencyEmail) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Review & Submit</h2>
          <p className="mt-2 text-gray-400">
            {agency.name} requires portal submission with CAPTCHA.
          </p>
        </div>

        <div className="rounded-lg bg-green-900/30 border border-green-700 p-4">
          <p className="text-green-300">
            Clicking submit will open a browser with the form already filled in.
            You just need to complete the CAPTCHA and click Submit!
          </p>
        </div>

        {portalError && (
          <div className="rounded-lg bg-red-900/30 border border-red-700 p-4">
            <p className="text-red-300">{portalError}</p>
          </div>
        )}

        {/* Summary */}
        <div className="rounded-lg border border-gray-600 p-4 space-y-3">
          <div>
            <span className="text-gray-400 text-sm">Agency:</span>
            <p className="text-white">{agency.name}</p>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Name:</span>
            <p className="text-white">{userDetails.firstName} {userDetails.lastName}</p>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Email:</span>
            <p className="text-white">{userDetails.email}</p>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Request:</span>
            <p className="text-white text-sm">{rephrasedRequest.substring(0, 150)}...</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            disabled={isFillingPortal}
            className="flex-1 rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isFillingPortal}
            className="flex-1 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isFillingPortal ? "Opening Browser..." : "Auto-Fill & Submit"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Review & Submit</h2>
        <p className="mt-2 text-gray-400">
          Please review your FOIA request before submitting.
        </p>
      </div>

      {/* Request Summary */}
      <div className="space-y-4 rounded-lg border border-gray-600 p-4">
        <div>
          <h3 className="text-sm font-medium text-gray-400">Agency</h3>
          <p className="text-white">{agency.name}</p>
          <p className="text-sm text-gray-400">
            {agencyEmail}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-400">Your Request</h3>
          <p className="whitespace-pre-wrap text-gray-200">{rephrasedRequest}</p>
        </div>

        <div className="border-t border-gray-600 pt-4">
          <h3 className="text-sm font-medium text-gray-400">Your Information</h3>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Name:</span>{" "}
              <span className="text-white">
                {userDetails.firstName} {userDetails.lastName}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Email:</span>{" "}
              <span className="text-white">{userDetails.email}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-400">Address:</span>{" "}
              <span className="text-white">
                {userDetails.address.line1}
                {userDetails.address.line2 && `, ${userDetails.address.line2}`},{" "}
                {userDetails.address.city}, {userDetails.address.state}{" "}
                {userDetails.address.zip}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Fee Category:</span>{" "}
              <span className="text-white">
                {feeCategoryLabels[userDetails.feeCategory]}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Max Fee:</span>{" "}
              <span className="text-white">${userDetails.maxFee}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submission info */}
      <div className="rounded-lg bg-blue-900/50 p-4 text-blue-300">
        <p className="font-medium">How Submission Works</p>
        <p className="text-sm">
          Clicking submit will open Gmail in a new tab with everything
          filled in. Just click Send in Gmail to submit your request.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition-colors hover:bg-gray-700"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Open Gmail & Submit
        </button>
      </div>
    </div>
  );
}
