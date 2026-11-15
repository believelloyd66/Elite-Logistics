
import { db } from "../firebase-config.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const trackingForm = document.getElementById("trackingForm");
const trackingInput = document.getElementById("trackingNumber");
const trackingResult = document.getElementById("trackingResult");

// Read tracking number from the homepage URL
const params = new URLSearchParams(window.location.search);
const urlTracking = params.get("tracking");

if (urlTracking && trackingInput) {
    trackingInput.value = urlTracking.toUpperCase();
}

if (trackingForm) {
    trackingForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const trackingNumber = trackingInput.value.trim().toUpperCase();

        if (!trackingNumber) return;

        trackingResult.textContent = "Searching for your shipment...";

        try {
            const trackingRef = doc(
                db,
                "publicTracking",
                trackingNumber
            );

            const snapshot = await getDoc(trackingRef);

            if (!snapshot.exists()) {
                trackingResult.textContent =
                    "No shipment found. Please check your tracking number.";
                return;
            }

            const shipment = snapshot.data();

            const details = [
                ["Tracking Number", shipment.trackingNumber],
                ["Current Status", shipment.status],
                ["Pickup Location", `${shipment.pickupCity}, ${shipment.pickupState}`],
                ["Destination", `${shipment.destinationCity}, ${shipment.destinationState}`]
            ];

            trackingResult.replaceChildren();

            const heading = document.createElement("h2");
            heading.textContent = "Shipment Details";
            trackingResult.appendChild(heading);

            details.forEach(([label, value]) => {
                const paragraph = document.createElement("p");
                const strong = document.createElement("strong");

                strong.textContent = label + ": ";

                paragraph.appendChild(strong);
                paragraph.appendChild(
                    document.createTextNode(value || "Not available")
                );

                trackingResult.appendChild(paragraph);
            });

        } catch (error) {
            console.error("Tracking error:", error);

            trackingResult.textContent =
                "Unable to retrieve shipment details. Please try again.";
        }
    });
}
