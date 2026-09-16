import { createFileRoute } from "@tanstack/react-router";
import { ForgeApp } from "@/components/anvil/forge-app";
import { pullEvents, pullHealth } from "@/lib/anvil/telemetry";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [health, events] = await Promise.all([pullHealth(), pullEvents(200)]);
    return { health, events, now: Date.now() };
  },
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <ForgeApp initial={initial} />;
}
