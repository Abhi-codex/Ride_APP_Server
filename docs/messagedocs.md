# Messaging API & Features Documentation

## Overview
This document describes the REST API and backend logic for the doctor-patient (and user-to-user) messaging/chat feature. All endpoints are authenticated and work for both doctors and patients.

---

## Endpoints & Features

### 1. Fetch Chat History
- **Endpoint:** `GET /messages?appointmentId=...` or `?otherUserId=...`
- **Purpose:** Fetch chat history for a specific appointment or between two users.
- **Returns:** `{ success: true, data: [ ...messages ] }` (array of message objects, sorted oldest to newest)

### 2. Send a Message
- **Endpoint:** `POST /messages`
- **Body:** `{ appointmentId, receiverId, content, type? }`
- **Returns:** `{ success: true, data: messageDoc }` (the created message object)

### 3. Delete a Message
- **Endpoint:** `DELETE /messages/:id`
- **Purpose:** Delete a message (only the sender can delete).
- **Returns:** `{ success: true, message: "Message deleted" }` or error.

### 4. Get Unread Message Count
- **Endpoint:** `GET /messages/unread/count?appointmentId=...` or `?otherUserId=...`
- **Purpose:** Get the count of unread messages in a chat (by appointment or user).
- **Returns:** `{ success: true, data: { count } }`

### 5. Mark Messages as Read
- **Endpoint:** `POST /messages/read`
- **Body:** `{ appointmentId, otherUserId }`
- **Returns:** `{ success: true, message: "Messages marked as read" }`

### 6. List All Chats (Chat List)
- **Endpoint:** `GET /messages/chats`
- **Purpose:** List all chat partners/chats for the current user, grouped by appointment or user.
- **Returns:**
```json
{
  "success": true,
  "data": [
    {
      "lastMessage": { ... },         // Last message in the chat
      "unreadCount": 2,               // Number of unread messages for the user
      "appointment": "appointmentId", // If chat is for an appointment
      "otherUser": "userId",          // The other user's ID
      "otherUserInfo": {              // Populated user info (name, role, email, phone)
        "_id": "...",
        "name": "...",
        "role": "...",
        "email": "...",
        "phone": "..."
      }
    },
    ...
  ]
}
```

---

## Who Uses What?
- **Patients and doctors** both use all endpoints. The logic is symmetric: a patient can chat with a doctor, and vice versa.
- The endpoints are generic and work for any user role, as long as the user is authenticated.

---

## Summary Table
| Endpoint                        | Method | For           | Returns/Effect                                 |
|----------------------------------|--------|---------------|-----------------------------------------------|
| `/messages`                     | GET    | All           | Chat history (array of messages)              |
| `/messages`                     | POST   | All           | Created message object                        |
| `/messages/:id`                 | DELETE | Sender only   | Success/error message                         |
| `/messages/unread/count`        | GET    | All           | `{ count }` of unread messages                |
| `/messages/read`                | POST   | All           | Success message (marks as read)               |
| `/messages/chats`               | GET    | All           | List of chats with last message, unread count |

---

## Socket.IO Events (if using real-time chat)
- `joinChat` — Join a chat room (by appointment or user pair)
- `sendMessage` — Send a message (broadcasts to room and saves to DB)
- `fetchMessages` — Fetch chat history (same as REST)
- `newMessage` — Event received when a new message arrives in the room

---

## Message Model (MongoDB)
- `appointment` (ObjectId, optional): Reference to Appointment
- `sender` (ObjectId): User who sent the message
- `receiver` (ObjectId): User who receives the message
- `content` (String): Message text
- `type` (String): Message type ("text", "system", ...)
- `timestamp` (Date): When the message was sent
- `read` (Boolean): Whether the message has been read

---

## Notes
- All endpoints require authentication.
- All features work for both doctors and patients.
- You can extend the model and endpoints for file attachments, message editing, etc.
