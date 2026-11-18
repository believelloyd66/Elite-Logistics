
import { db, customerAuth } from "../firebase-config.js";

import {
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    writeBatch,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";


const chatBody = document.getElementById("chatBody");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const chatStatus = document.getElementById("chatStatus");
const welcomeMessage = document.querySelector(".welcome-message");

const MESSAGE_LIFETIME = 7 * 24 * 60 * 60 * 1000;

let currentUser = null;
let conversationId = null;
let unsubscribeMessages = null;
let isSending = false;


function showStatus(message) {
    if (chatStatus) {
        chatStatus.textContent = message;
    }
}


function getExpiryDate() {
    return Timestamp.fromDate(
        new Date(Date.now() + MESSAGE_LIFETIME)
    );
}


function waitForAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(
            auth,
            user => {
                unsubscribe();
                resolve(user);
            },
            error => {
                unsubscribe();
                reject(error);
            }
        );
    });
}


async function findActiveConversation() {
    const conversationsRef = collection(
        db,
        "supportConversations"
    );

    const q = query(
        conversationsRef,
        where("ownerUid", "==", currentUser.uid)
    );

    const snapshot = await getDocs(q);

    const now = Date.now();

    const activeConversations = snapshot.docs
        .filter(item => {
            const data = item.data();

            return data.expiresAt &&
                data.expiresAt.toDate().getTime() > now;
        })
        .sort((a, b) => {
            return b.data().lastMessageAt.toMillis() -
                a.data().lastMessageAt.toMillis();
        });

    if (activeConversations.length > 0) {
        conversationId = activeConversations[0].id;
        listenToMessages();
    }
}


function createMessage(messageData) {
    const messageElement = document.createElement("div");

    messageElement.className =
        messageData.senderRole === "admin"
            ? "message received"
            : "message sent";

    const textElement = document.createElement("p");
    textElement.textContent = messageData.text;

    messageElement.appendChild(textElement);

    if (messageData.createdAt) {
        const timeElement = document.createElement("small");

        const date = messageData.createdAt.toDate();

        timeElement.textContent = date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

        messageElement.appendChild(timeElement);
    }

    return messageElement;
}


function listenToMessages() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    if (!conversationId) return;

    const messagesRef = collection(
        db,
        "supportConversations",
        conversationId,
        "messages"
    );

    const q = query(
        messagesRef,
        orderBy("createdAt", "asc")
    );

    unsubscribeMessages = onSnapshot(
        q,
        snapshot => {
            chatBody.innerHTML = "";

            let visibleMessages = 0;

            snapshot.forEach(messageDoc => {
                const messageData = messageDoc.data();

                if (
                    !messageData.expiresAt ||
                    messageData.expiresAt.toDate().getTime() <= Date.now()
                ) {
                    return;
                }

                chatBody.appendChild(
                    createMessage(messageData)
                );

                visibleMessages++;
            });

            if (visibleMessages === 0 && welcomeMessage) {
                chatBody.appendChild(welcomeMessage);
            }

            chatBody.scrollTop = chatBody.scrollHeight;
        },
        error => {
            console.error("Message listener error:", error);
            showStatus("Unable to load messages. Please refresh.");
        }
    );
}


async function initializeChat() {
    try {
        showStatus("Connecting to support...");

        let user = await waitForAuth();

        if (user && !user.isAnonymous) {
            showStatus(
                "Please open customer support in a separate browser session."
            );
            sendButton.disabled = true;
            return;
        }

        if (!user) {
            const credential = await signInAnonymously(auth);
            user = credential.user;
        }

        currentUser = user;

        await findActiveConversation();

        showStatus("Connected. You can send a message.");

    } catch (error) {
        console.error("Support initialization error:", error);
        showStatus("Unable to connect. Please refresh the page.");
    }
}


async function sendMessage() {
    const messageText = messageInput.value.trim();

    if (!messageText || isSending) return;

    if (messageText.length > 2000) {
        showStatus("Your message is too long.");
        return;
    }

    if (!currentUser) {
        showStatus("Please wait. Connecting to support...");
        return;
    }

    isSending = true;
    sendButton.disabled = true;

    try {
        const expiryDate = getExpiryDate();
        const batch = writeBatch(db);

        let activeConversationId = conversationId;

        // Check that the existing conversation has not expired.
        if (activeConversationId) {
            const existingRef = doc(
                db,
                "supportConversations",
                activeConversationId
            );

            const existingSnapshot = await getDoc(existingRef);

            if (!existingSnapshot.exists()) {
                activeConversationId = null;
            } else {
                const existingData = existingSnapshot.data();

                if (
                    !existingData.expiresAt ||
                    existingData.expiresAt.toDate().getTime() <= Date.now()
                ) {
                    activeConversationId = null;
                }
            }
        }

        // Create a conversation only when the customer sends a message.
        if (!activeConversationId) {
            const newConversationRef = doc(
                collection(db, "supportConversations")
            );

            activeConversationId = newConversationRef.id;

            batch.set(newConversationRef, {
                ownerUid: currentUser.uid,
                createdAt: serverTimestamp(),
                lastMessageAt: serverTimestamp(),
                lastMessage: messageText,
                unreadForAdmin: true,
                expiresAt: expiryDate
            });

        } else {
            const conversationRef = doc(
                db,
                "supportConversations",
                activeConversationId
            );

            batch.update(conversationRef, {
                lastMessage: messageText,
                lastMessageAt: serverTimestamp(),
                unreadForAdmin: true,
                expiresAt: expiryDate
            });
        }

        const messagesRef = collection(
            db,
            "supportConversations",
            activeConversationId,
            "messages"
        );

        const newMessageRef = doc(messagesRef);

        batch.set(newMessageRef, {
            text: messageText,
            senderRole: "customer",
            authorUid: currentUser.uid,
            createdAt: serverTimestamp(),
            expiresAt: expiryDate
        });

        await batch.commit();

        conversationId = activeConversationId;

        messageInput.value = "";
        showStatus("Message sent.");

        if (!unsubscribeMessages) {
            listenToMessages();
        }

    } catch (error) {
    console.error("Send message error:", error);

    showStatus(
        "ERROR: " +
        (error.code || "unknown") +
        " - " +
        (error.message || "No error details available")
    );

} finally {
        isSending = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
}


sendButton.addEventListener("click", sendMessage);


messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});


initializeChat();
