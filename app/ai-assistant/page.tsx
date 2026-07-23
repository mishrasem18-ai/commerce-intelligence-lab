import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { AiAssistant } from "@/components/ai/ai-assistant";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AiAssistantPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-6 text-primary" />
            AI Assistant
          </span>
        }
        description="Ask questions about your commerce data in plain language."
        actions={<Badge variant="default">Beta</Badge>}
      />
      <AiAssistant />
    </div>
  );
}
