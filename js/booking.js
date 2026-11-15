
const bookingForm = document.getElementById("bookingForm");

if (bookingForm) {
    bookingForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!bookingForm.reportValidity()) return;

        const button = bookingForm.querySelector(
            'button[type="submit"]'
        );

        const formData = new FormData(bookingForm);
        const bookingDetails = {};

        formData.forEach((value, key) => {
            bookingDetails[key] = value.trim();
        });

        if (button) {
            button.disabled = true;
            button.textContent = "Submitting...";
        }

        try {
            const response = await fetch("/api/booking", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(bookingDetails)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Booking failed."
                );
            }

            alert(
                "Booking submitted successfully!\n\n" +
                "Your tracking number is:\n" +
                result.trackingNumber
            );

            bookingForm.reset();

        } catch (error) {
            console.error("Booking error:", error);

            alert(
                error.message ||
                "Unable to submit booking. Please try again."
            );

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Submit Shipment Request";
            }
        }
    });
}
