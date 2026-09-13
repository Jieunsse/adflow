export const CREATE_EVENTS = {
  started: "create_started",
  creativeGenerated: "creative_generated",
  deliveryEntered: "delivery_entered",
  campaignRequested: "campaign_requested",
} as const;

export function recordCreateEvent(event: typeof CREATE_EVENTS[keyof typeof CREATE_EVENTS]): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("adflow:analytics", { detail: { event } }));
}
