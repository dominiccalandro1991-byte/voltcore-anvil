import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/guard";
import { CommandCenter } from "@/components/command-center";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Authed>
      <CommandCenter />
    </Authed>
  );
}
