document.addEventListener("DOMContentLoaded", () => {
    if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const sections = document.querySelectorAll("main .section");
    const skipTags = new Set(["svg", "path", "circle", "rect", "line", "polyline", "polygon"]);
    sections.forEach(section => {
        section.querySelectorAll("*").forEach(el => {
            if (el.closest(".gallery-section")) {
                return;
            }
            if (skipTags.has(el.tagName.toLowerCase())) {
                return;
            }
            if (el.closest(".icon")) {
                return;
            }
            el.classList.add("reveal");
        });
    });

    const reveals = document.querySelectorAll(".reveal");
    const supportsIntersectionObserver = "IntersectionObserver" in window;

    if (supportsIntersectionObserver) {
        const observer = new IntersectionObserver((entries, observerInstance) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    if (entry.target.matches(".menu, .menu > div")) {
                        entry.target.querySelectorAll(".reveal").forEach(child => {
                            child.classList.add("visible");
                            observerInstance.unobserve(child);
                        });
                    }
                    observerInstance.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: "0px 0px -50px 0px"
        });

        reveals.forEach(el => {
            observer.observe(el);

            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight) {
                el.classList.add("visible");
                observer.unobserve(el);
            }
        });
    } else {
        reveals.forEach(el => {
            el.classList.add("visible");
        });
    }

    const nav = document.getElementById("main-nav");
    if (nav) {
        const navToggle = nav.querySelector(".nav-toggle");
        const navLinks = nav.querySelectorAll(".nav-links a");

        if (navToggle) {
            navToggle.addEventListener("click", () => {
                const isOpen = nav.classList.toggle("open");
                navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
                document.body.classList.toggle("menu-open", isOpen);
            });
        }

        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                nav.classList.remove("open");
                if (navToggle) {
                    navToggle.setAttribute("aria-expanded", "false");
                }
                document.body.classList.remove("menu-open");
            });
        });
    }

    const targetDate = new Date("2026-10-24T14:00:00");
    const countdownValues = {
        days: document.querySelector('[data-unit="days"]'),
        hours: document.querySelector('[data-unit="hours"]'),
        minutes: document.querySelector('[data-unit="minutes"]'),
        seconds: document.querySelector('[data-unit="seconds"]')
    };

    const updateCountdown = () => {
        const now = new Date();
        const diff = targetDate - now;

        if (diff <= 0) {
            Object.values(countdownValues).forEach(el => {
                if (el) el.textContent = "00";
            });
            return;
        }

        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (countdownValues.days) countdownValues.days.textContent = String(days).padStart(2, "0");
        if (countdownValues.hours) countdownValues.hours.textContent = String(hours).padStart(2, "0");
        if (countdownValues.minutes) countdownValues.minutes.textContent = String(minutes).padStart(2, "0");
        if (countdownValues.seconds) countdownValues.seconds.textContent = String(seconds).padStart(2, "0");
    };

    updateCountdown();
    setInterval(updateCountdown, 1000);
});

const revealPage = () => {
    document.body.classList.remove("page-loading");
    document.body.classList.add("page-loaded");
};

const waitForFonts = () => {
    if (document.fonts && typeof document.fonts.ready?.then === "function") {
        return document.fonts.ready.catch(() => {});
    }

    return Promise.resolve();
};

window.addEventListener("load", () => {
    waitForFonts().then(() => {
        requestAnimationFrame(revealPage);
    });
});

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
}

function showForm(isComing) {
    const container = document.getElementById("form-container");
    if (!container) {
        return;
    }

    container.innerHTML = "";

    let formEmbed = "";

    const loadingText = window.I18n?.t("rsvp.formLoading", null, "");

    if (isComing) {
        formEmbed = `<iframe src="https://docs.google.com/forms/d/e/1FAIpQLSeOEfwvRcQtsM5D7jp4TaJ4_0VbNjcPWsNgESJNdr9wNfSqYg/viewform?embedded=true" 
            height="1206" frameborder="0" marginheight="0" marginwidth="0">${loadingText}</iframe>`;
    } else {
        formEmbed = `<iframe src="https://docs.google.com/forms/d/e/1FAIpQLSdmqlZdZB9KO__K5Az1ecDVWf3_HaU9Bh6EQGuNWELk-7fsuw/viewform?embedded=true" 
            height="551" frameborder="0" marginheight="0" marginwidth="0">${loadingText}</iframe>`;
    }

    container.innerHTML = formEmbed;
}
