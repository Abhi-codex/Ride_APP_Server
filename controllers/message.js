import Message from "../models/Message.js";

// Fetch chat history (by appointment or user pair)
export const getMessages = async (req, res) => {
  try {
    const { appointmentId, otherUserId, limit = 50, skip = 0 } = req.query;
    const userId = req.user.id;
    let query = {};
    if (appointmentId) {
      query.appointment = appointmentId;
    } else if (otherUserId) {
      query.$or = [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId }
      ];
    } else {
      return res.status(400).json({ success: false, message: "Missing appointmentId or otherUserId for chat history." });
    }
    const messages = await Message.find(query)
      .sort({ timestamp: 1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error("Error fetching chat history:", err);
    res.status(500).json({ success: false, message: "Failed to fetch chat history" });
  }
};

// Send a message (REST, not socket)
export const sendMessage = async (req, res) => {
  try {
    const { appointmentId, receiverId, content, type = "text" } = req.body;
    const senderId = req.user.id;
    if (!content || !receiverId) {
      return res.status(400).json({ success: false, message: "Missing content or receiverId." });
    }
    const messageDoc = await Message.create({
      appointment: appointmentId,
      sender: senderId,
      receiver: receiverId,
      content,
      type,
      timestamp: new Date()
    });
    res.json({ success: true, data: messageDoc });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
};

// Delete a message (only sender can delete)
export const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({ success: false, message: "You can only delete your own messages" });
    }
    await message.deleteOne();
    res.json({ success: true, message: "Message deleted" });
  } catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ success: false, message: "Failed to delete message" });
  }
};

// Unread count per chat (by appointment or user)
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appointmentId, otherUserId } = req.query;
    let query = { receiver: userId, read: false };
    if (appointmentId) {
      query.appointment = appointmentId;
    } else if (otherUserId) {
      query.$or = [
        { sender: otherUserId, receiver: userId },
        { sender: userId, receiver: otherUserId }
      ];
    } else {
      return res.status(400).json({ success: false, message: "Missing appointmentId or otherUserId for unread count." });
    }
    const count = await Message.countDocuments(query);
    res.json({ success: true, data: { count } });
  } catch (err) {
    console.error("Error fetching unread count:", err);
    res.status(500).json({ success: false, message: "Failed to fetch unread count" });
  }
};

// Mark messages as read (by appointment or user)
export const markMessagesRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appointmentId, otherUserId } = req.body;
    let query = { receiver: userId, read: false };
    if (appointmentId) {
      query.appointment = appointmentId;
    } else if (otherUserId) {
      query.$or = [
        { sender: otherUserId, receiver: userId },
        { sender: userId, receiver: otherUserId }
      ];
    } else {
      return res.status(400).json({ success: false, message: "Missing appointmentId or otherUserId for mark as read." });
    }
    await Message.updateMany(query, { $set: { read: true } });
    res.json({ success: true, message: "Messages marked as read" });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    res.status(500).json({ success: false, message: "Failed to mark messages as read" });
  }
};