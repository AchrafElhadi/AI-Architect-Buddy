import { useState } from "react";
import { useLocation } from "wouter";
import { FlaskConical, Send, Bot, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useListProducts, useSimulateMessage } from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react";

export default function SimulatePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [productId, setProductId] = useState<string>("");
  const [fbUserId, setFbUserId] = useState("sim_user_001");
  const [fbUserName, setFbUserName] = useState("Test User");
  const [message, setMessage] = useState("");
  const [lastResult, setLastResult] = useState<{
    conversationId: number;
    userMessage: Message;
    aiReply: Message | null;
  } | null>(null);

  const { data: products = [] } = useListProducts();
  const simulate = useSimulateMessage();

  const handleSimulate = async () => {
    if (!productId || !message.trim()) {
      toast({ title: "Validation", description: "Select a product and enter a message", variant: "destructive" });
      return;
    }

    try {
      const result = await simulate.mutateAsync({
        data: {
          productId: parseInt(productId, 10),
          fbUserId,
          fbUserName: fbUserName || undefined,
          message: message.trim(),
        },
      });

      setLastResult({
        conversationId: result.conversation.id,
        userMessage: result.userMessage,
        aiReply: result.aiReply,
      });
      setMessage("");
    } catch (e) {
      toast({ title: "Error", description: "Simulation failed", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Simulate Conversation</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Test the AI assistant without connecting to Facebook. Send a message and see the AI response.
        </p>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-5 space-y-4 mb-6">
        <div className="space-y-1.5">
          <Label>Product *</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a product..." />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name} — {Number(p.price).toFixed(2)} MAD
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {products.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No products found. <button onClick={() => navigate("/products")} className="text-primary hover:underline">Add a product first</button>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Fake User ID</Label>
            <Input value={fbUserId} onChange={(e) => setFbUserId(e.target.value)} placeholder="sim_user_001" />
          </div>
          <div className="space-y-1.5">
            <Label>Fake User Name</Label>
            <Input value={fbUserName} onChange={(e) => setFbUserName(e.target.value)} placeholder="Test User" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Message *</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. How much is this? / كم ثمنه؟ / C'est combien?"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSimulate();
              }
            }}
          />
        </div>

        <Button
          onClick={handleSimulate}
          disabled={simulate.isPending || !productId || !message.trim()}
          className="w-full gap-2"
        >
          <Send size={14} />
          {simulate.isPending ? "Sending..." : "Simulate Message"}
        </Button>
      </div>

      {lastResult && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Conversation Preview</div>

          <div className="space-y-3">
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                <User size={12} />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-2.5 text-sm max-w-[80%]">
                {lastResult.userMessage.content}
              </div>
            </div>

            {lastResult.aiReply && (
              <div className="flex gap-2 justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2.5 text-sm max-w-[80%]">
                  {lastResult.aiReply.content}
                </div>
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={12} className="text-primary" />
                </div>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/conversations/${lastResult.conversationId}`)}
            className="gap-1.5 w-full"
          >
            View Full Conversation
            <ArrowRight size={13} />
          </Button>
        </div>
      )}
    </div>
  );
}
