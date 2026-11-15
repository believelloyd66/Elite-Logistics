import { adminDb } from "../lib/firebaseAdmin.js";
import { randomUUID } from "node:crypto";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed."
        });
    }

    try {
        const allowedFields = [
            "customerName",
            "phone",
            "email",
            "pickupAddress",
            "pickupCity",
            "pickupState",
            "destinationAddress",
            "destinationCity",
            "destinationState",
            "shippingMethod",
            "parcelType",
            "weight",
            "quantity",
            "additionalInfo"
        ];

        const bookingDetails = {};

        for (const field of allowedFields) {
            const value = req.body?.[field];

            bookingDetails[field] =
                typeof value === "string" ? value.trim() : "";
        }

        const requiredFields = [
            "customerName",
            "phone",
            "pickupAddress",
            "pickupCity",
            "pickupState",
            "destinationAddress",
            "destinationCity",
            "destinationState",
            "shippingMethod",
            "parcelType"
        ];

        for (const field of requiredFields) {
            if (!bookingDetails[field]) {
                return res.status(400).json({
                    success: false,
                    message: `Please provide ${field}.`
                });
            }
        }

        for (const value of Object.values(bookingDetails)) {
            if (value.length > 1000) {
                return res.status(400).json({
                    success: false,
                    message: "One or more fields are too long."
                });
            }
        }

        const trackingNumber =
            "EL-" + randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();

        const shipmentRef = adminDb
            .collection("shipments")
            .doc(trackingNumber);

        const publicRef = adminDb
            .collection("publicTracking")
            .doc(trackingNumber);

        const timestamp = new Date();

        const shipment = {
            ...bookingDetails,
            trackingNumber,
            status: "Shipment Received",
            createdAt: timestamp,
            updatedAt: timestamp
        };

        const publicDetails = {
            trackingNumber,
            status: "Shipment Received",
            pickupCity: bookingDetails.pickupCity,
            pickupState: bookingDetails.pickupState,
            destinationCity: bookingDetails.destinationCity,
            destinationState: bookingDetails.destinationState,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        const batch = adminDb.batch();

        batch.set(shipmentRef, shipment);
        batch.set(publicRef, publicDetails);

        await batch.commit();

        return res.status(201).json({
            success: true,
            message: "Booking submitted successfully.",
            trackingNumber
        });

    } catch (error) {
        console.error("Booking error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to submit booking. Please try again."
        });
    }
}
