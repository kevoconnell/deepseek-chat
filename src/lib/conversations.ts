import { db } from "./db";
import { Conversation, Message } from "./db/schema";

export async function createConversation(title: string): Promise<string> {
  const result = await db
    .insertInto("conversations")
    .values({
      title,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(["id"])
    .executeTakeFirst();

  if (!result?.id) {
    throw new Error("Failed to create conversation");
  }

  return result.id;
}

export async function listConversations(
  limit: number = 20
): Promise<Conversation[]> {
  return await db
    .selectFrom("conversations")
    .selectAll()
    .orderBy("updated_at", "desc")
    .limit(limit)
    .execute();
}

export async function getConversation(
  id: string
): Promise<{ conversation: Conversation; messages: Message[] } | null> {
  const conversation = await db
    .selectFrom("conversations")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!conversation) {
    return null;
  }

  const messages = await db
    .selectFrom("messages")
    .selectAll()
    .where("conversation_id", "=", id)
    .orderBy("created_at", "asc")
    .execute();

  return {
    conversation,
    messages,
  };
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<void> {
  await db
    .updateTable("conversations")
    .set({
      title,
      updated_at: new Date(),
    })
    .where("id", "=", id)
    .execute();
}

export async function deleteConversation(id: string): Promise<void> {
  await db.deleteFrom("conversations").where("id", "=", id).execute();
}
