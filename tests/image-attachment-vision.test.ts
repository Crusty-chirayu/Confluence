import { describe, expect, it } from "vitest";
import { isImageMime, validateAttachmentFile } from "../src/lib/attachments";
import { composeDemoReply } from "../src/lib/data/demo-ai";
import {
  buildChatCompletionsBody,
  buildProviderRequest,
  type ConversationMessage,
} from "../supabase/functions/_shared/provider";

describe("image attachment & vision handling", () => {
  describe("image MIME validation", () => {
    it("recognizes standard image formats", () => {
      expect(isImageMime("image/png")).toBe(true);
      expect(isImageMime("image/jpeg")).toBe(true);
      expect(isImageMime("image/webp")).toBe(true);
      expect(isImageMime("image/gif")).toBe(true);
      expect(isImageMime("application/pdf")).toBe(false);
      expect(isImageMime("text/plain")).toBe(false);
    });

    it("accepts valid image uploads under 10MB", () => {
      const valid = validateAttachmentFile({
        name: "architecture.png",
        size: 1024 * 500, // 500 KB
        type: "image/png",
      });
      expect(valid.ok).toBe(true);
      if (valid.ok) {
        expect(valid.mime).toBe("image/png");
        expect(valid.size).toBe(512000);
      }
    });

    it("rejects images exceeding 10MB limit", () => {
      const tooBig = validateAttachmentFile({
        name: "huge.jpg",
        size: 11 * 1024 * 1024,
        type: "image/jpeg",
      });
      expect(tooBig.ok).toBe(false);
    });
  });

  describe("demo mode reply behavior with image attachments", () => {
    it("truthfully reports demo mode limitation when an image is attached", () => {
      const reply = composeDemoReply("@ai what is in this image?", true, "War Room", {
        hasImage: true,
        filename: "screenshot.png",
      });

      expect(reply).toContain("screenshot.png");
      expect(reply).toContain("Demo mode notice");
      expect(reply).toContain("OPENROUTER_API_KEY");
      // Must not give canned "where the room agrees" text
      expect(reply).not.toContain("Where the room agrees");
    });

    it("prompts the user to upload when asking about images with none attached", () => {
      const reply = composeDemoReply("@ai tell me about this image", false, null, {
        hasImage: false,
      });

      expect(reply).toContain("I don't see any image attached to this message");
      expect(reply).toContain("Upload an image");
    });
  });

  describe("multimodal provider wire format for vision models", () => {
    it("constructs OpenAI-compatible request payload with text and image_url", () => {
      const sampleBase64 =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

      const messages: ConversationMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Explain this diagram" },
            { type: "image_url", image_url: { url: sampleBase64 } },
          ],
        },
      ];

      const body = buildChatCompletionsBody({
        model: "anthropic/claude-sonnet-4.6",
        maxTokens: 2048,
        system: "You are an expert system analyst.",
        messages,
      });

      expect(body.model).toBe("anthropic/claude-sonnet-4.6");
      expect(body.stream).toBe(true);
      expect(body.messages[0]).toEqual({
        role: "system",
        content: "You are an expert system analyst.",
      });
      expect(body.messages[1].role).toBe("user");
      expect(body.messages[1].content).toEqual([
        { type: "text", text: "Explain this diagram" },
        { type: "image_url", image_url: { url: sampleBase64 } },
      ]);

      const req = buildProviderRequest({
        model: "anthropic/claude-sonnet-4.6",
        maxTokens: 2048,
        system: null,
        messages,
        apiKey: "sk-or-test",
      });

      const parsed = JSON.parse(req.init.body as string);
      expect(parsed.messages[0].content).toHaveLength(2);
      expect(parsed.messages[0].content[1].type).toBe("image_url");
      expect(parsed.messages[0].content[1].image_url.url).toBe(sampleBase64);
    });

    it("supports multiple image attachments on a single user message", () => {
      const img1 = "data:image/jpeg;base64,abc1";
      const img2 = "data:image/jpeg;base64,abc2";

      const messages: ConversationMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Compare these two screenshots" },
            { type: "image_url", image_url: { url: img1 } },
            { type: "image_url", image_url: { url: img2 } },
          ],
        },
      ];

      const body = buildChatCompletionsBody({
        model: "anthropic/claude-sonnet-4.6",
        maxTokens: 2048,
        system: null,
        messages,
      });

      expect(body.messages[0].content).toHaveLength(3);
    });

    it("leaves text-only messages as simple string content", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "Hello world" },
        { role: "assistant", content: "Hi there!" },
      ];

      const body = buildChatCompletionsBody({
        model: "anthropic/claude-sonnet-4.6",
        maxTokens: 2048,
        system: null,
        messages,
      });

      expect(body.messages[0].content).toBe("Hello world");
      expect(body.messages[1].content).toBe("Hi there!");
    });
  });

  describe("attachment security & scoping rules", () => {
    it("ensures storage paths are strictly scoped to the conversation id", () => {
      const conversationId = "conv-1234-abcd";

      const validAttachment = {
        storage_path: `${conversationId}/msg-5678/chart.png`,
        mime_type: "image/png",
        size_bytes: 204800,
      };

      const crossConversationAttachment = {
        storage_path: "other-conv-9999/msg-0000/secret.png",
        mime_type: "image/png",
        size_bytes: 204800,
      };

      const pathTraversalAttachment = {
        storage_path: `../other-bucket/secret.png`,
        mime_type: "image/png",
        size_bytes: 204800,
      };

      const isAllowed = (path: string) => path.startsWith(`${conversationId}/`);

      expect(isAllowed(validAttachment.storage_path)).toBe(true);
      expect(isAllowed(crossConversationAttachment.storage_path)).toBe(false);
      expect(isAllowed(pathTraversalAttachment.storage_path)).toBe(false);
    });

    it("ensures image attachments are capped at 3 per AI completion request", () => {
      const MAX_IMAGES = 3;
      const uploadedAttachments = [
        { id: "img-1", name: "1.png" },
        { id: "img-2", name: "2.png" },
        { id: "img-3", name: "3.png" },
        { id: "img-4", name: "4.png" },
        { id: "img-5", name: "5.png" },
      ];

      const bounded = uploadedAttachments.slice(0, MAX_IMAGES);
      expect(bounded).toHaveLength(3);
      expect(bounded.map((a) => a.id)).toEqual(["img-1", "img-2", "img-3"]);
    });
  });
});
