
import { auth, db } from "../firebase-config.js";

import {
    collection,
    doc,
    query,
    orderBy,
    onSnapshot,
    writeBatch,
    serverTimestamp,
    Timestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";


// ======================================
// ADMIN CONFIGURATION
// ======================================

const approvedAdmins = [
    "believelloyd66@gmail.com",
    "jimsigns0@gmail.com"
];

const conversationList = document.getElementById("supportConversationList");
const messagesContainer = document.getElementById("adminSupportMessages");
const customerTitle = document.getElementById("supportCustomerTitle");
const customerSubtitle = document.getElementById("supportCustomerSubtitle");
const listStatus = document.getElementById("supportListStatus");
const chatStatus = document.getElementById("supportChatStatus");
const replyForm = document.getElementById("supportReplyForm");
const replyInput = document.getElementById("supportReplyInput");
const replyButton = document.getElementById("supportReplyButton");


// ======================================
// STATE
// ======================================

let currentAdmin = null;
let conversations = [];
let selectedConversationId = null;

let unsubscribeConversations = null;
let unsubscribeMessages = null;

let sendingReply = false;


// ======================================
// HELPERS
// ======================================

function isApprovedAdmin(user) {
    return user &&
        user.emailVerified === true &&
        approvedAdmins.includes(user.email?.toLowerCase());
}


function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "";
    }

    return timestamp.toDate().toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function isConversationActive(data) {
    if (!data.expiresAt) return false;

    return data.expiresAt.toMillis() > Date.now();
}


function showEmptyMessage(container, message) {
    container.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "support-empty";
    empty.textContent = message;

    container.appendChild(empty);
}


// ======================================
// LOAD CONVERSATIONS
// ======================================

function startConversationListener() {
    if (unsubscribeConversations) {
        unsubscribeConversations();
    }

    const conversationsQuery = query(
        collection(db, "supportConversations"),
        orderBy("lastMessageAt", "desc")
    );

    unsubscribeConversations = onSnapshot(
        conversationsQuery,

        snapshot => {
            conversations = [];

            snapshot.forEach(documentSnapshot => {
                const data = documentSnapshot.data();

                if (!isConversationActive(data)) return;

                conversations.push({
                    id: documentSnapshot.id,
                    ...data
                });
            });

            renderConversationList();

            listStatus.textContent =
                `${conversations.length} active conversation(s)`;

            if (selectedConversationId) {
                const stillExists = conversations.some(
                    item => item.id === selectedConversationId
                );

                if (!stillExists) {
                    stopMessageListener();

                    selectedConversationId = null;

                    customerTitle.textContent = "Select a conversation";
                    customerSubtitle.textContent = "This conversation has expired.";

                    showEmptyMessage(
                        messagesContainer,
                        "This conversation is no longer available."
                    );

                    replyInput.disabled = true;
                    replyButton.disabled = true;
                }
            }
        },

        error => {
            console.error("Support conversation error:", error);

            listStatus.textContent =
                "Unable to load support conversations. Check your Firebase rules and connection.";
        }
    );
}


// ======================================
// DISPLAY CONVERSATION LIST
// ======================================

function renderConversationList() {
    conversationList.replaceChildren();

    if (conversations.length === 0) {
        showEmptyMessage(
            conversationList,
            "No active customer conversations yet."
        );

        return;
    }

    conversations.forEach(conversation => {
        const item = document.createElement("div");

        item.className = "support-conversation";

        if (conversation.id === selectedConversationId) {
            item.classList.add("active");
        }

        const title = document.createElement("strong");
        title.textContent = "Customer conversation";

        const preview = document.createElement("small");
        preview.textContent =
            conversation.lastMessage || "No message preview";

        const date = document.createElement("small");
        date.textContent = formatDate(conversation.lastMessageAt);

        item.appendChild(title);
        item.appendChild(preview);
        item.appendChild(date);

        if (conversation.unreadForAdmin === true) {
            const unread = document.createElement("span");

            unread.className = "support-unread";
            unread.textContent = "New message";

            item.appendChild(unread);
        }

        item.addEventListener("click", () => {
            openConversation(conversation.id);
        });

        conversationList.appendChild(item);
    });
}


// ======================================
// STOP MESSAGE LISTENER
// ======================================

function stopMessageListener() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
}


// ======================================
// OPEN CONVERSATION
// ======================================

function openConversation(conversationId) {
    const conversation = conversations.find(
        item => item.id === conversationId
    );

    if (!conversation) return;

    selectedConversationId = conversationId;

    renderConversationList();

    customerTitle.textContent = "Customer conversation";
    customerSubtitle.textContent = "Customer support chat";

    chatStatus.textContent = "Loading messages...";

    replyInput.disabled = false;
    replyButton.disabled = false;

    stopMessageListener();

    showEmptyMessage(messagesContainer, "Loading messages...");

    const conversationRef = doc(
        db,
        "supportConversations",
        conversationId
    );

    // Clear the admin's unread notification.
    const readBatch = writeBatch(db);

    readBatch.update(conversationRef, {
        unreadForAdmin: false
    });

    readBatch.commit().catch(error => {
        console.error("Could not update unread status:", error);
    });

    const messagesQuery = query(
        collection(
            db,
            "supportConversations",
            conversationId,
            "messages"
        ),
        orderBy("createdAt", "asc")
    );

    unsubscribeMessages = onSnapshot(
        messagesQuery,

        snapshot => {
            messagesContainer.replaceChildren();

            let visibleMessages = 0;

            snapshot.forEach(messageDocument => {
                const message = messageDocument.data();

                if (
                    !message.expiresAt ||
                    message.expiresAt.toMillis() <= Date.now()
                ) {
                    return;
                }

                visibleMessages++;

                const bubble = document.createElement("div");

                bubble.className =
                    "admin-chat-message " +
                    (message.senderRole === "admin" ? "admin" : "customer");

                const messageText = document.createElement("div");
                messageText.textContent = message.text || "";

                const messageTime = document.createElement("small");

                messageTime.textContent =
                    (message.senderRole === "admin" ? "You" : "Customer") +
                    " · " +
                    formatDate(message.createdAt);

                bubble.appendChild(messageText);
                bubble.appendChild(messageTime);

                messagesContainer.appendChild(bubble);
            });

            if (visibleMessages === 0) {
                showEmptyMessage(
                    messagesContainer,
                    "No messages in this conversation yet."
                );
            }

            messagesContainer.scrollTop =
                messagesContainer.scrollHeight;

            chatStatus.textContent = "";
        },

        error => {
            console.error("Message loading error:", error);

            chatStatus.textContent =
                "Unable to load messages. Check your Firebase rules.";
        }
    );
}


// ======================================
// SEND ADMIN REPLY
// ======================================

replyForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (sendingReply) return;

    if (!currentAdmin || !selectedConversationId) {
        chatStatus.textContent =
            "Select a customer conversation first.";
        return;
    }

    const messageText = replyInput.value.trim();

    if (!messageText) {
        chatStatus.textContent = "Write a message before sending.";
        return;
    }

    if (messageText.length > 2000) {
        chatStatus.textContent = "Your message is too long.";
        return;
    }

    sendingReply = true;
    replyButton.disabled = true;

    chatStatus.textContent = "Sending reply...";

    try {
        const conversationRef = doc(
            db,
            "supportConversations",
            selectedConversationId
        );

        // Check the latest conversation expiry before replying.
        const conversationSnapshot = await getDoc(conversationRef);

        if (!conversationSnapshot.exists()) {
            throw new Error("This conversation no longer exists.");
        }

        const conversationData = conversationSnapshot.data();

        if (!isConversationActive(conversationData)) {
            throw new Error("This conversation has expired.");
        }

        const messagesRef = collection(
            conversationRef,
            "messages"
        );

        const newMessageRef = doc(messagesRef);

        const expiryTime = Timestamp.fromMillis(
            Date.now() + (7 * 24 * 60 * 60 * 1000)
        );

        const batch = writeBatch(db);

        batch.set(newMessageRef, {
            text: messageText,
            senderRole: "admin",
            authorUid: currentAdmin.uid,
            createdAt: serverTimestamp(),
            expiresAt: expiryTime
        });

        batch.update(conversationRef, {
            lastMessage: messageText,
            lastMessageAt: serverTimestamp(),
            unreadForAdmin: false,
            expiresAt: expiryTime
        });

        await batch.commit();

        replyInput.value = "";
        chatStatus.textContent = "Reply sent.";

    } catch (error) {
        console.error("Reply sending error:", error);

        chatStatus.textContent =
            "Reply failed: " + error.message;

    } finally {
        sendingReply = false;

        replyButton.disabled = !selectedConversationId;
    }
});


// ======================================
// AUTHENTICATION
// ======================================

onAuthStateChanged(auth, user => {
    if (!isApprovedAdmin(user)) {
        currentAdmin = null;
        conversations = [];
        selectedConversationId = null;

        if (unsubscribeConversations) {
            unsubscribeConversations();
            unsubscribeConversations = null;
        }

        stopMessageListener();

        conversationList.replaceChildren();
        messagesContainer.replaceChildren();

        customerTitle.textContent = "Select a conversation";
        customerSubtitle.textContent = "";

        replyInput.disabled = true;
        replyButton.disabled = true;

        listStatus.textContent = "Administrator login required.";

        return;
    }

    currentAdmin = user;

    startConversationListener();
});
