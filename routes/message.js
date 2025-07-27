import express from "express";
import auth from "../middleware/authentication.js";
import { getMessages, sendMessage, deleteMessage, getUnreadCount, markMessagesRead } from "../controllers/message.js";

const router = express.Router();

// GET /messages?appointmentId=... or ?otherUserId=...

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
