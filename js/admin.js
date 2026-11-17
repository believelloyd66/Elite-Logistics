
import { db, auth } from "../firebase-config.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    sendEmailVerification,
    reload
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
    collection,
    doc,
    getDocs,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// APPROVED ADMIN EMAILS
const approvedAdmins = [
    "believelloyd66@gmail.com",
    "jimsigns0@gmail.com"
];

// ELEMENTS
const loginForm = document.getElementById("loginForm");
const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("adminDashboard");
const loginMessage = document.getElementById("loginMessage");

const logoutButton = document.getElementById("logoutButton");
const shipmentTable = document.getElementById("shipmentTable");

const searchInput = document.getElementById("adminSearch");
const searchButton = document.getElementById("searchButton");
const searchMessage = document.getElementById("searchMessage");

const updateButton = document.getElementById("updateButton");
const updateTracking = document.getElementById("updateTracking");
const shipmentStatus = document.getElementById("shipmentStatus");
const updateMessage = document.getElementById("updateMessage");

let shipments = [];
let verificationButton = null;

// SHOW MESSAGE
function showMessage(element, message) {
    if (element) {
        element.textContent = message;
    }
}

// SHOW ADMIN DASHBOARD
async function showAdminDashboard() {
    if (loginBox) loginBox.style.display = "none";
    if (dashboard) dashboard.style.display = "block";

    if (verificationButton) {
        verificationButton.remove();
        verificationButton = null;
    }

    await loadShipments();
}

// CREATE VERIFICATION CHECK BUTTON
function createVerificationButton() {
    if (verificationButton || !loginMessage) return;

    verificationButton = document.createElement("button");

    verificationButton.type = "button";
    verificationButton.textContent =
        "I've verified my email — check again";

    verificationButton.style.display = "block";
    verificationButton.style.marginTop = "12px";
    verificationButton.style.padding = "10px 15px";
    verificationButton.style.cursor = "pointer";

    verificationButton.addEventListener("click", async () => {
        const user = auth.currentUser;

        if (!user) {
            showMessage(loginMessage, "Please log in again.");
            return;
        }

        verificationButton.disabled = true;
        showMessage(loginMessage, "Checking verification...");

        try {
            await reload(user);

            if (user.emailVerified) {
                showMessage(
                    loginMessage,
                    "Email verified. Opening admin dashboard..."
                );

                await showAdminDashboard();
            } else {
                showMessage(
                    loginMessage,
                    "Your email is not verified yet. Open the verification email and click its link."
                );
            }

        } catch (error) {
            console.error("Verification check error:", error);

            showMessage(
                loginMessage,
                "Unable to check verification. Please try again."
            );

        } finally {
            if (verificationButton) {
                verificationButton.disabled = false;
            }
        }
    });

    loginMessage.insertAdjacentElement(
        "afterend",
        verificationButton
    );
}

// ADMIN LOGIN
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document
            .getElementById("adminEmail")
            .value.trim()
            .toLowerCase();

        const password = document
            .getElementById("adminPassword")
            .value;

        if (!approvedAdmins.includes(email)) {
            showMessage(
                loginMessage,
                "This email is not authorized."
            );
            return;
        }

        showMessage(loginMessage, "Checking login...");

        try {
            const result = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            if (!result.user.emailVerified) {
                await sendEmailVerification(result.user);

                showMessage(
                    loginMessage,
                    "Verification email sent. Check your inbox and click the verification link."
                );

                createVerificationButton();
                return;
            }

            showMessage(
                loginMessage,
                "Login successful. Opening dashboard..."
            );

        } catch (error) {
            console.error("Login error:", error);

            let message = "Login failed. Check your email and password.";

            if (error.code === "auth/too-many-requests") {
                message = "Too many attempts. Please try again later.";
            } else if (error.code === "auth/invalid-credential") {
                message = "Incorrect email or password.";
            }

            showMessage(loginMessage, message);
        }
    });
}

// CHECK ADMIN ACCESS
onAuthStateChanged(auth, async (user) => {

    if (!loginBox || !dashboard) return;

    if (!user) {
        loginBox.style.display = "block";
        dashboard.style.display = "none";

        if (verificationButton) {
            verificationButton.remove();
            verificationButton = null;
        }

        return;
    }

    const email = user.email
        ? user.email.toLowerCase()
        : "";

    if (!approvedAdmins.includes(email)) {
        showMessage(
            loginMessage,
            "This email is not authorized."
        );

        await signOut(auth);
        return;
    }

    if (!user.emailVerified) {
        loginBox.style.display = "block";
        dashboard.style.display = "none";

        showMessage(
            loginMessage,
            "Your email needs verification before you can access the dashboard."
        );

        createVerificationButton();
        return;
    }

    await showAdminDashboard();
});

// LOGOUT
if (logoutButton) {
    logoutButton.addEventListener("click", async () => {

        try {
            await signOut(auth);
            window.location.reload();

        } catch (error) {
            console.error("Logout error:", error);
            alert("Unable to log out. Please try again.");
        }

    });
}

// LOAD SHIPMENTS
async function loadShipments() {

    try {
        const snapshot = await getDocs(
            collection(db, "shipments")
        );

        shipments = snapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));

        shipments.sort((a, b) => {
            const dateA = a.createdAt?.toMillis?.() || 0;
            const dateB = b.createdAt?.toMillis?.() || 0;

            return dateB - dateA;
        });

        displayShipments(shipments);
        updateStatistics(shipments);

    } catch (error) {
        console.error("Loading error:", error);

        if (shipmentTable) {
            shipmentTable.textContent =
                "Unable to load shipments. Check your connection.";
        }
    }
}

// DISPLAY SHIPMENTS
function displayShipments(records) {

    if (!shipmentTable) return;

    shipmentTable.replaceChildren();

    if (records.length === 0) {
        const row = shipmentTable.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 4;
        cell.textContent = "No shipments found.";

        return;
    }

    records.forEach(shipment => {

        const row = shipmentTable.insertRow();

        const values = [
            shipment.trackingNumber,
            shipment.customerName,
            `${shipment.destinationCity || ""}, ${shipment.destinationState || ""}`,
            shipment.status
        ];

        values.forEach(value => {
            const cell = row.insertCell();
            cell.textContent = value || "N/A";
        });

    });
}

// UPDATE STATISTICS
function updateStatistics(records) {

    const total = document.getElementById("totalShipments");
    const transit = document.getElementById("inTransit");
    const delivered = document.getElementById("delivered");

    if (total) {
        total.textContent = records.length;
    }

    if (transit) {
        transit.textContent = records.filter(
            item => item.status === "In Transit"
        ).length;
    }

    if (delivered) {
        delivered.textContent = records.filter(
            item => item.status === "Delivered"
        ).length;
    }
}

// SEARCH SHIPMENTS
function searchShipments() {

    if (!searchInput) return;

    const search = searchInput.value
        .trim()
        .toLowerCase();

    const results = shipments.filter(item =>
        (item.trackingNumber || "").toLowerCase().includes(search) ||
        (item.customerName || "").toLowerCase().includes(search)
    );

    displayShipments(results);

    showMessage(
        searchMessage,
        results.length + " shipment(s) found."
    );
}

if (searchButton) {
    searchButton.addEventListener(
        "click",
        searchShipments
    );
}

if (searchInput) {
    searchInput.addEventListener(
        "input",
        searchShipments
    );
}

// UPDATE SHIPMENT STATUS
if (updateButton) {

    updateButton.addEventListener("click", async () => {

        const trackingNumber = updateTracking
            ? updateTracking.value.trim().toUpperCase()
            : "";

        const newStatus = shipmentStatus
            ? shipmentStatus.value
            : "";

        if (!trackingNumber || !newStatus) {
            showMessage(
                updateMessage,
                "Enter a tracking number and select a status."
            );
            return;
        }

        // FIXED: Use item.trackingNumber here
        const shipment = shipments.find(item =>
            item.trackingNumber === trackingNumber
        );

        if (!shipment) {
            showMessage(
                updateMessage,
                "Shipment not found."
            );
            return;
        }

        updateButton.disabled = true;

        showMessage(
            updateMessage,
            "Updating shipment..."
        );

        try {
            const batch = writeBatch(db);

            batch.update(
                doc(db, "shipments", shipment.id),
                {
                    status: newStatus,
                    updatedAt: serverTimestamp()
                }
            );

            batch.update(
                doc(db, "publicTracking", trackingNumber),
                {
                    status: newStatus,
                    updatedAt: serverTimestamp()
                }
            );

            await batch.commit();

            showMessage(
                updateMessage,
                "Shipment status updated successfully."
            );

            await loadShipments();

        } catch (error) {
            console.error("Update error:", error);

            showMessage(
                updateMessage,
                "Update failed. Check your administrator permissions."
            );

        } finally {
            updateButton.disabled = false;
        }

    });
}
