"use client";

import * as React from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  aiConversation,
  aiSuggestions,
  kpis,
  monthlySeries,
  trafficSources,
  conversionFunnel,
  type AiMessage,
} from "@/lib/data";
import { LOW_STOCK_THRESHOLD } from "@/lib/data/products";
import { useProducts } from "@/lib/store/products-store";
import { useOrders } from "@/lib/store/orders-store";
import { useCustomers } from "@/lib/store/customers-store";
import { answerQuestion, type CommerceSnapshot } from "@/lib/ai/assistant-engine";
import { cn } from "@/lib/utils";

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `local-${idCounter}`;
}

export function AiAssistant() {
  const [messages, setMessages] = React.useState<AiMessage[]>(aiConversation);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Live commerce data — the assistant answers from the same stores the admin
  // dashboards read, so buyer activity (orders, inventory, signups) is
  // reflected. `send` is rebuilt when this data changes so answers stay fresh.
  const { products } = useProducts();
  const { orders } = useOrders();
  const { customers } = useCustomers();
  const snapshot = React.useMemo<CommerceSnapshot>(
    () => ({
      products,
      orders,
      customers,
      kpis,
      monthly: monthlySeries,
      traffic: trafficSources,
      funnel: conversionFunnel,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    }),
    [products, orders, customers],
  );

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  const send = React.useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: trimmed },
    ]);
    setInput("");
    setThinking(true);
    // Route intent + build the answer from live data when the reply lands.
    window.setTimeout(() => {
      const { content } = answerQuestion(trimmed, snapshot);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content },
      ]);
      setThinking(false);
    }, 900);
  }, [snapshot]);

  return (
    <div className="flex h-[calc(100vh-9.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {thinking && <ThinkingBubble />}

        {messages.length <= 2 && (
          <div className="pt-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Suggested prompts
            </p>
            <div className="flex flex-wrap gap-2">
              {aiSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => send(suggestion.prompt)}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                >
                  {suggestion.prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3 sm:p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 rounded-xl border border-input bg-background p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask about revenue, products, customers…"
            aria-label="Message the AI assistant"
            className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || thinking}
            aria-label="Send message"
          >
            <ArrowUp />
          </Button>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Insights are generated from demo data for illustration only.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AiMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {isUser ? (
        <Avatar name="Anurag Mishra" size="sm" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted text-foreground",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="size-4" />
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-muted px-4 py-3.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-2 animate-bounce rounded-full bg-muted-foreground/50"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
