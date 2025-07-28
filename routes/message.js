import express from "express";
import auth from "../middleware/authentication.js";
import { getMessages, sendMessage, deleteMessage, getUnreadCount, markMessagesRead, getChatList } from "../controllers/message.js";

const router = express.Router();
// List all chat partners/chats for the current user
router.get("/chats", auth, getChatList);

// Fetch chat history
router.get("/", auth, getMessages);

// Send a message
router.post("/", auth, sendMessage);

// Delete a message (only sender can delete)
router.delete("/:id", auth, deleteMessage);

// Get unread message count per chat (by appointment or user)
router.get("/unread/count", auth, getUnreadCount);

// Mark messages as read (by appointment or user)
router.post("/read", auth, markMessagesRead);

export default router;
