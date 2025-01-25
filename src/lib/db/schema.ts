import { Generated, Insertable, Selectable, Updateable } from "kysely";

export interface Database {
  conversations: ConversationTable;
  messages: MessageTable;
  embeddings: EmbeddingTable;
}

export interface ConversationTable {
  id: Generated<string>;
  title: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface MessageTable {
  id: Generated<string>;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: Generated<Date>;
}

export interface EmbeddingTable {
  id: Generated<string>;
  message_id: string;
  embedding: number[];
  created_at: Generated<Date>;
}

export type Conversation = Selectable<ConversationTable>;
export type NewConversation = Insertable<ConversationTable>;
export type ConversationUpdate = Updateable<ConversationTable>;

export type Message = Selectable<MessageTable>;
export type NewMessage = Insertable<MessageTable>;

export type Embedding = Selectable<EmbeddingTable>;
export type NewEmbedding = Insertable<EmbeddingTable>;
