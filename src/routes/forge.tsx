import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/guard";
import { ForgeApp } from "@/components/anvil/forge-app";

export const Route = createFileRoute("/forge")({ component: ForgePage });

function ForgePage() {
  return (
    <Authed>
      <ForgeApp embedded />
    </Authed>
  );
}
