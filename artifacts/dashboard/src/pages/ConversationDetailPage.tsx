import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import { ArrowLeft, Bot, User, Send, Zap, Tag, Package, AlertCircle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetConversation,
  useSendMessage,
  useTriggerAiReply,
  useUpdateConversation,
  getGetConversationQueryKey,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";

const statusConfig = {
  confirmed: { label: "Confirmed", class: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
  in_progress: { label: "In Progress", class: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock },
  manual_intervention: { label: "Manual Required", class: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertCircle },
};

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const convId = parseInt(params.id ?? "0", 10);

  const [messageText, setMessageText] = useState("");

  const { data: conv, isLoading } = useGetConversation(convId);

  const sendMessage = useSendMessage();
  const triggerAi = useTriggerAiReply();
  const updateConv = useUpdateConversation();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
    queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;
    try {
      await sendMessage.mutateAsync({ id: convId, data: { content: messageText.trim() } });
      setMessageText("");
      invalidate();
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    }
  };

  const handleAiReply = async () => {
    try {
      await triggerAi.mutateAsync({ id: convId });
      invalidate();
      toast({ title: "AI replied", description: "AI response generated" });
    } catch {
      toast({ title: "Error", description: "Failed to generate AI reply", variant: "destructive" });
    }
  };

  const handleModeToggle = async (isAi: boolean) => {
    try {
      await updateConv.mutateAsync({
        id: convId,
        data: {
          mode: isAi ? "ai" : "manual",
          status: isAi ? "in_progress" : "manual_intervention",
        },
      });
      invalidate();
    } catch {
      toast({ title: "Error", description: "Failed to update mode", variant: "destructive" });
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await updateConv.mutateAsync({ id: convId, data: { status: status as "confirmed" | "in_progress" | "manual_intervention" } });
      invalidate();
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Conversation not found</div>
      </div>
    );
  }

  const statusCfg = statusConfig[conv.status as keyof typeof statusConfig] ?? statusConfig.in_progress;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                {(conv.fbUserName ?? conv.fbUserId).charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm">{conv.fbUserName ?? conv.fbUserId}</div>
                <div className="text-xs text-muted-foreground">{conv.productName}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.class}`}>
              <StatusIcon size={11} />
              {statusCfg.label}
            </span>

            <div className="flex items-center gap-2">
              <User size={14} className={conv.mode !== "ai" ? "text-amber-600" : "text-muted-foreground"} />
              <Switch
                checked={conv.mode === "ai"}
                onCheckedChange={handleModeToggle}
                id="mode-toggle"
              />
              <Bot size={14} className={conv.mode === "ai" ? "text-primary" : "text-muted-foreground"} />
              <Label htmlFor="mode-toggle" className="text-xs text-muted-foreground">
                {conv.mode === "ai" ? "AI Mode" : "Manual Mode"}
              </Label>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
          {conv.messages.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No messages yet
            </div>
          )}
          {conv.messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                  <User size={12} />
                </div>
              )}
              <div className={`max-w-[70%] ${msg.role === "user" ? "" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-muted text-foreground rounded-tl-none"
                      : "bg-primary text-primary-foreground rounded-tr-none"
                  }`}
                >
                  {msg.content}
                </div>
                <div className={`flex items-center gap-1.5 mt-1 text-xs text-muted-foreground ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                  {msg.role === "assistant" && (
                    <>
                      {msg.source === "ai" ? <Bot size={10} /> : <User size={10} />}
                      <span>{msg.source === "ai" ? "AI" : "Manual"}</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                </div>
              </div>
              {msg.role === "assistant" && (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.source === "ai" ? "bg-primary/10" : "bg-amber-100"}`}>
                  {msg.source === "ai" ? <Bot size={12} className="text-primary" /> : <User size={12} className="text-amber-600" />}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-border bg-card">
          {conv.mode === "ai" ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 text-sm text-muted-foreground bg-muted rounded-lg px-4 py-3">
                AI is managing this conversation automatically
              </div>
              <Button
                onClick={handleAiReply}
                disabled={triggerAi.isPending}
                size="sm"
                className="gap-1.5"
              >
                <Zap size={14} />
                {triggerAi.isPending ? "Generating..." : "Trigger AI Reply"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                rows={2}
                className="flex-1 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                onClick={handleSend}
                disabled={sendMessage.isPending || !messageText.trim()}
                size="sm"
                className="self-end"
              >
                <Send size={14} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="w-72 flex-shrink-0 border-l border-border overflow-auto p-4 space-y-4">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Product Info</div>
          <div className="bg-card border border-card-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-primary" />
              <span className="font-medium text-sm">{conv.product.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-muted-foreground" />
              <span className="text-sm font-semibold">{Number(conv.product.price).toFixed(2)} MAD</span>
            </div>
            {conv.product.colors && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Colors:</span> {conv.product.colors}
              </div>
            )}
            {conv.product.stock != null && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Stock:</span> {conv.product.stock} units
              </div>
            )}
            {conv.product.description && (
              <div className="text-xs text-muted-foreground mt-1">{conv.product.description}</div>
            )}
            {conv.product.facebookPostUrl && (
              <a
                href={conv.product.facebookPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <ExternalLink size={10} />
                View Post
              </a>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status</div>
          <div className="space-y-1.5">
            {Object.entries(statusConfig).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => handleStatusChange(key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium border transition-all ${
                    conv.status === key
                      ? cfg.class
                      : "bg-card border-card-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon size={12} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Info</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div><span className="font-medium">User ID:</span> {conv.fbUserId}</div>
            <div><span className="font-medium">Messages:</span> {conv.messageCount}</div>
            <div><span className="font-medium">Started:</span> {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}</div>
            <div><span className="font-medium">Updated:</span> {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
