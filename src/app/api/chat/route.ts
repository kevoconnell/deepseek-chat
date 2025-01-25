import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { NewMessage } from "@/lib/db/schema";
import { findSimilarMessages, storeEmbedding } from "@/lib/embeddings";
import {
  createConversation,
  updateConversationTitle,
} from "@/lib/conversations";

// Function to format thinking content
function formatThinking(content: string): string {
  let result = "";
  let isThinking = false;
  let currentThought = "";
  let i = 0;

  // Handle case where content starts with <think> but has no closing tag
  const hasOpenTag = content.includes("<think>");
  const hasCloseTag = content.includes("</think>");
  if (hasOpenTag && !hasCloseTag) {
    return `*${content.replace("<think>", "").trim()}*`;
  }

  while (i < content.length) {
    // Check for opening think tag
    if (content.slice(i, i + 7) === "<think>") {
      isThinking = true;
      i += 7;
      continue;
    }

    // Check for closing think tag
    if (content.slice(i, i + 8) === "</think>") {
      isThinking = false;
      if (currentThought.trim()) {
        result += `*${currentThought.trim()}*`;
        currentThought = "";
      }
      i += 8;
      continue;
    }

    // Handle content
    if (isThinking) {
      currentThought += content[i];
    } else {
      // If we have a pending thought and non-think content starts, flush the thought
      if (currentThought.trim()) {
        result += `*${currentThought.trim()}*`;
        currentThought = "";
      }
      result += content[i];
    }
    i++;
  }

  // Handle any remaining thought content
  if (currentThought.trim()) {
    result += `*${currentThought.trim()}*`;
  }

  return result;
}

async function generateTitle(
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          ...messages,
          {
            role: "user",
            content:
              "Based on our conversation so far, generate a very brief and concise title (max 6 words). Respond with ONLY the title, no explanation or extra text.",
          },
        ],
        stream: false,
      }),
    });

    const data = await response.json();
    return data.message?.content?.trim() || "New Conversation";
  } catch (error) {
    console.error("Error generating title:", error);
    return "New Conversation";
  }
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { message, conversationId, model, title } = await req.json();

    // Create a new conversation if no ID is provided
    const actualConversationId =
      conversationId ||
      (await createConversation(
        title || `Chat started at ${new Date().toLocaleString()}`
      ));

    // Find similar messages for context
    const relevantContext = await findSimilarMessages(
      message,
      actualConversationId
    );
    const contextPrompt =
      relevantContext.length > 0
        ? `\nRelevant context from previous conversations:\n${relevantContext.join(
            "\n"
          )}`
        : "";

    // Store user message and its embedding
    const userMessageResult = await db
      .insertInto("messages")
      .values({
        conversation_id: actualConversationId,
        role: "user",
        content: message,
      } as NewMessage)
      .returning(["id"])
      .executeTakeFirst();

    if (!userMessageResult?.id) {
      throw new Error("Failed to store user message");
    }

    // Generate and store embedding for the user message
    await storeEmbedding(userMessageResult.id, message);

    // Get conversation history
    const history = await db
      .selectFrom("messages")
      .select(["content", "role"])
      .where("conversation_id", "=", actualConversationId)
      .orderBy("created_at", "asc")
      .execute();

    // Check if we should generate a title (after 2 messages)
    const shouldGenerateTitle = !title && history.length === 3; // 2 messages + current user message

    // Format messages for Ollama
    const messages = [
      {
        role: "system",
        content: `You are a helpful AI assistant. Stay focused on directly answering the user's questions. Format your responses carefully following these rules:

1. Structure and Spacing:
   - Use proper line breaks between paragraphs
   - Add a blank line before and after lists
   - Add a blank line before and after code blocks
   - Use proper indentation for nested content

2. Markdown Formatting:
   - Use ## for section headings
   - Use **bold** for emphasis (with spaces around it)
   - Use *italic* for secondary emphasis
   - Use \`code\` for technical terms
   - Use \`\`\` for code blocks
   - Use > for quotes
   - Use [link](url) for links

3. Lists and Paragraphs:
   - Use - for bullet points (with a space after)
   - Use 1. for numbered lists (with a space after)
   - Keep paragraphs focused and separated
   - Use proper punctuation with spaces after

Remember: If you're explaining your thought process or reasoning about something, it MUST be wrapped in <think> tags to appear in blue thought bubbles.`,
      },
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // Add context to the last user message
    if (messages.length > 1 && contextPrompt) {
      messages[messages.length - 1].content += contextPrompt;
    }

    // Create a new ReadableStream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let hasStartedResponse = false;

        try {
          // Send thinking state
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "thinking",
                content: true,
              })}\n\n`
            )
          );

          // Send to Ollama with streaming enabled
          const response = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: messages,
              stream: true,
            }),
          });

          if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("No response reader available");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const json = JSON.parse(line);
                  if (json.message?.content) {
                    if (!hasStartedResponse) {
                      hasStartedResponse = true;
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "thinking",
                            content: false,
                          })}\n\n`
                        )
                      );
                    }

                    // Send each chunk immediately
                    const chunk = json.message.content;
                    if (chunk) {
                      fullResponse += chunk; // Store original for saving to DB

                      // Send the chunk immediately without modification
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "chunk",
                            content: chunk,
                          })}\n\n`
                        )
                      );
                    }
                  }
                } catch {
                  continue;
                }
              }
            }
          }

          // Format the full response for storage
          fullResponse = formatThinking(fullResponse);

          // Store the complete response and its embedding
          const assistantMessageResult = await db
            .insertInto("messages")
            .values({
              conversation_id: actualConversationId,
              role: "assistant",
              content: fullResponse,
            } as NewMessage)
            .returning(["id"])
            .executeTakeFirst();

          if (assistantMessageResult?.id) {
            await storeEmbedding(assistantMessageResult.id, fullResponse);
          }

          // Generate title if needed
          if (shouldGenerateTitle) {
            const newTitle = await generateTitle(messages, model);
            await updateConversationTitle(actualConversationId, newTitle);
          }

          // Send the conversation ID
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                conversationId: actualConversationId,
              })}\n\n`
            )
          );
        } catch (err) {
          console.error("Streaming error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error:
                  err instanceof Error ? err.message : "Unknown error occurred",
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat message" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
