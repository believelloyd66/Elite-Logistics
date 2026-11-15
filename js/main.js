
// MOBILE NAVIGATION

function toggleMenu() {
    const navigation = document.getElementById("navigation");

    if (navigation) {
        navigation.classList.toggle("show");
    }
}


// CLOSE MENU AFTER CLICKING A LINK

document.querySelectorAll(".navigation a").forEach(link => {
    link.addEventListener("click", () => {
        const navigation = document.getElementById("navigation");

        if (navigation) {
            navigation.classList.remove("show");
        }
    });
});


// UPDATE FOOTER YEAR

const copyright = document.querySelector(".copyright");

if (copyright) {
    copyright.textContent =
        `© ${new Date().getFullYear()} Elite Logistics. All rights reserved.`;
}
