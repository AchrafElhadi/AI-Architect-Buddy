import { useState } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Bot, User, AlertCircle, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useListConversations, useListProducts } from "@workspace/api-client-react";
import type { Conversation, Product } from "@workspace/api-client-react";

type Tab = "all" | "confirmed" | "in_progress" | "manual";

const statusConfig = {
  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock },
  manual_intervention: { label: "Manual", color: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as keyof typeof statusConfig] ?? { label: status, color: "bg-gray-100 text-gray-800", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function ModeIcon({ mode }: { mode: string }) {
  return mode === "ai"
    ? <Bot size={12} className="text-primary" />
    : <User size={12} className="text-amber-600" />;
}

function ConversationCard({
  conv,
  onClick,
}: {
  conv: Conversation;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 p-4 bg-card border border-card-border rounded-lg cursor-pointer hover:shadow-sm transition-all hover:border-primary/30 group"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
        {(conv.fbUserName ?? conv.fbUserId).charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm text-foreground">{conv.fbUserName ?? conv.fbUserId}</span>
            <ModeIcon mode={conv.mode} />
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mb-1.5">{conv.productName}</div>
        {conv.lastMessage && (
          <p className="text-sm text-foreground/70 truncate mb-2">{conv.lastMessage}</p>
        )}
        <div className="flex items-center gap-2">
          <StatusBadge status={conv.status} />
          <span className="text-xs text-muted-foreground">{conv.messageCount} messages</span>
        </div>
      </div>
      <ChevronRight size={14} className="text-muted-foreground mt-1 flex-shrink-0 group-hover:text-primary transition-colors" />
    </div>
  );
}

function ConversationList({ tab, productId }: { tab: string; productId?: number }) {
  const [, navigate] = useLocation();
  const apiTab = tab === "all" ? undefined : tab as "confirmed" | "in_progress" | "manual";
  const { data: conversations = [], isLoading } = useListConversations({ tab: apiTab, productId });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-card border border-card-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <MessageSquareIcon />
        <p className="mt-3 text-sm">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <ConversationCard
          key={conv.id}
          conv={conv}
          onClick={() => navigate(`/conversations/${conv.id}`)}
        />
      ))}
    </div>
  );
}

function MessageSquareIcon() {
  return (
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted">
      <Bot size={20} className="text-muted-foreground" />
    </div>
  );
}

export default function ConversationsPage() {
  const [selectedProduct, setSelectedProduct] = useState<number | undefined>(undefined);
  const { data: products = [] } = useListProducts();

  return (
    <div className="flex h-full">
      <div className="w-52 flex-shrink-0 border-r border-border bg-background p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Filter by Product</div>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedProduct(undefined)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${!selectedProduct ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
          >
            All Products
          </button>
          {products.map((p: Product) => (
            <button
              key={p.id}
              onClick={() => setSelectedProduct(p.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors truncate ${selectedProduct === p.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-0 border-b border-border">
          <h1 className="text-xl font-bold text-foreground mb-4">Conversations</h1>
          <Tabs defaultValue="all">
            <TabsList className="mb-0">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto py-4 px-0">
              <TabsContent value="all">
                <ConversationList tab="all" productId={selectedProduct} />
              </TabsContent>
              <TabsContent value="in_progress">
                <ConversationList tab="in_progress" productId={selectedProduct} />
              </TabsContent>
              <TabsContent value="confirmed">
                <ConversationList tab="confirmed" productId={selectedProduct} />
              </TabsContent>
              <TabsContent value="manual">
                <ConversationList tab="manual" productId={selectedProduct} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
