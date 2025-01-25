import { db } from "./db";
import pgvector from "pgvector/kysely";
import OpenAI from "openai";
import dotenv from "dotenv";
import { sql } from "kysely";

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY, // Make sure to set this in your environment variables
});

export default openai;

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 512,
  });
  return response.data[0].embedding;
}

export async function storeEmbedding(messageId: string, content: string) {
  const embedding = await generateEmbedding(content);

  await db
    .insertInto("embeddings")
    .values({
      message_id: messageId,
      embedding: pgvector.toSql(embedding),
      created_at: new Date(),
    })
    .execute();
}

export async function findSimilarMessages(
  query: string,
  conversationId?: string,
  minSimilarity = 0.75
): Promise<{ content: string; score: number }[]> {
  const embedding = await generateEmbedding(query);

  // Join with messages table to get conversation_id
  const results = await db
    .selectFrom("embeddings")
    .innerJoin("messages", "messages.id", "embeddings.message_id")
    .select([
      "messages.content",
      "messages.conversation_id",
      sql<number>`(embeddings.embedding <=> ${JSON.stringify(embedding)})`.as(
        "similarity"
      ),
    ])
    .orderBy("similarity", "desc")
    .limit(5)
    .execute();

  return results.map((row) => ({
    content: row.content,
    score: row.similarity * (row.conversation_id === conversationId ? 1.5 : 1),
  }));
}
