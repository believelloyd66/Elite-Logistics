import { db, auth } from "../firebase-config.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
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

// SHOW MESSAGE
function showMessage(element, message) {
    if (element) {
        element.textContent = message;
    }
}

// ADMIN LOGIN
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document
            .getElementById("adminEmail")
            .value.trim().toLowerCase();

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
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        } catch (error) {
            console.error("Login error:", error);

            showMessage(
                loginMessage,
                "Login failed. Check your email and password."
            );
        }
    });
}

// CHECK ADMIN ACCESS
onAuthStateChanged(auth, async (user) => {

    if (!loginBox || !dashboard) return;

    if (!user) {
        loginBox.style.display = "block";
        dashboard.style.display = "none";
        return;
    }

    const email = user.email
        ? user.email.toLowerCase()
        : "";

    if (
        !approvedAdmins.includes(email) ||
        !user.emailVerified
    ) {
        alert(
            "Access denied. A verified administrator account is required."
        );

        await signOut(auth);
        return;
    }

    loginBox.style.display = "none";
    dashboard.style.display = "block";

    await loadShipments();
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

        // NEWEST SHIPMENTS FIRST
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
