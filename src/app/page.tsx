"use client";

import { useState, useEffect } from "react";
import QueryStep from "@/components/steps/QueryStep";
import ReviewStep from "@/components/steps/ReviewStep";
import DetailsStep from "@/components/steps/DetailsStep";
import SubmitStep from "@/components/steps/SubmitStep";
import { WizardState, RephraseResponse, AgencyComponent, UserDetails } from "@/lib/types";

const STORAGE_KEY = "foia-creator-state";

const INITIAL_STATE: WizardState = {
  step: 1,
  query: "",
  rephraseResponse: null,
  selectedAgency: null,
  userDetails: null,
  isLoading: false,
  error: null,
};

function loadSavedState(): { state: WizardState; editedRequest: string } {
  if (typeof window === "undefined") {
    return { state: INITIAL_STATE, editedRequest: "" };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        state: { ...parsed.state, isLoading: false, error: null },
        editedRequest: parsed.editedRequest || "",
      };
    }
  } catch (e) {
    console.error("Failed to load saved state:", e);
  }
  return { state: INITIAL_STATE, editedRequest: "" };
}

export default function Home() {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [editedRequest, setEditedRequest] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load saved state on mount
  useEffect(() => {
    const saved = loadSavedState();
    setState(saved.state);
    setEditedRequest(saved.editedRequest);
    setIsHydrated(true);
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ state, editedRequest })
      );
    }
  }, [state, editedRequest, isHydrated]);

  const handleQuerySubmit = async (query: string) => {
    setState((prev) => ({ ...prev, query, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/rephrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error("Failed to process your request");
      }

      const data: RephraseResponse = await response.json();
      setEditedRequest(data.rephrased);
      setState((prev) => ({
        ...prev,
        rephraseResponse: data,
        step: 2,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "An error occurred",
      }));
    }
  };

  const handleReviewContinue = (request: string, agency: AgencyComponent) => {
    setEditedRequest(request);
    setState((prev) => ({ ...prev, selectedAgency: agency, step: 3 }));
  };

  const handleDetailsSubmit = (details: UserDetails) => {
    setState((prev) => ({ ...prev, userDetails: details, step: 4 }));
  };

  const handleReset = () => {
    setState(INITIAL_STATE);
    setEditedRequest("");
    localStorage.removeItem(STORAGE_KEY);
  };

  const goBack = () => {
    setState((prev) => ({
      ...prev,
      step: Math.max(1, prev.step - 1) as 1 | 2 | 3 | 4,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800">
        <div className="mx-auto max-w-2xl px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">FOIA Creator</h1>
            <p className="text-sm text-gray-400">
              Create and submit FOIA requests in minutes
            </p>
          </div>
          {state.step > 1 && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-400 hover:text-white underline"
            >
              Start Over
            </button>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b border-gray-700 bg-gray-800">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: "Request" },
              { num: 2, label: "Review" },
              { num: 3, label: "Details" },
              { num: 4, label: "Submit" },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    state.step >= s.num
                      ? "bg-blue-600 text-white"
                      : "bg-gray-600 text-gray-400"
                  }`}
                >
                  {state.step > s.num ? (
                    <svg
                      className="h-4 w-4"
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
                  ) : (
                    s.num
                  )}
                </div>
                <span
                  className={`ml-2 hidden text-sm sm:inline ${
                    state.step >= s.num ? "text-white" : "text-gray-500"
                  }`}
                >
                  {s.label}
                </span>
                {i < 3 && (
                  <div
                    className={`mx-4 h-0.5 w-12 sm:w-20 ${
                      state.step > s.num ? "bg-blue-600" : "bg-gray-600"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl bg-gray-800 p-6 shadow-sm sm:p-8">
          {/* Error Display */}
          {state.error && (
            <div className="mb-6 rounded-lg bg-red-900/50 p-4 text-red-300">
              <p className="font-medium">Error</p>
              <p className="text-sm">{state.error}</p>
            </div>
          )}

          {/* Step 1: Query */}
          {state.step === 1 && (
            <QueryStep
              initialQuery={state.query}
              onSubmit={handleQuerySubmit}
              isLoading={state.isLoading}
            />
          )}

          {/* Step 2: Review */}
          {state.step === 2 && state.rephraseResponse && (
            <ReviewStep
              rephraseResponse={state.rephraseResponse}
              onContinue={handleReviewContinue}
              onBack={goBack}
            />
          )}

          {/* Step 3: Details */}
          {state.step === 3 && (
            <DetailsStep
              initialDetails={state.userDetails}
              onSubmit={handleDetailsSubmit}
              onBack={goBack}
            />
          )}

          {/* Step 4: Submit */}
          {state.step === 4 &&
            state.selectedAgency &&
            state.userDetails &&
            state.rephraseResponse && (
              <SubmitStep
                rephrasedRequest={editedRequest}
                briefDescription={state.rephraseResponse.briefDescription}
                agency={state.selectedAgency}
                userDetails={state.userDetails}
                onBack={goBack}
                onReset={handleReset}
              />
            )}
        </div>
      </main>
    </div>
  );
}
