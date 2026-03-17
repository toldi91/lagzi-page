(function () {
    "use strict";

    const script = document.currentScript;
    const config = {
        filePath: script?.dataset.i18nFile || "i18n/i18n.json",
        defaultLanguage: script?.dataset.i18nDefault || "hu"
    };

    const state = {
        config: null,
        translations: {},
        languages: {},
        activeLanguage: null,
        switcher: null
    };

    const safeStorage = {
        get(key) {
            try {
                return localStorage.getItem(key);
            } catch (error) {
                return null;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (error) {
                // Ignore storage errors in restricted contexts.
            }
        }
    };

    const resolvePath = (obj, path) => {
        if (!obj || !path) {
            return undefined;
        }

        return path.split(".").reduce((acc, key) => {
            if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
                return acc[key];
            }
            return undefined;
        }, obj);
    };

    const formatValue = (value, params) => {
        if (typeof value !== "string") {
            return value;
        }

        if (!params) {
            return value;
        }

        return value.replace(/\{(\w+)\}/g, (_, key) => {
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                return String(params[key]);
            }
            return `{${key}}`;
        });
    };

    const getTranslation = (key, params, fallback = "") => {
        const currentTranslations = state.translations[state.activeLanguage] || {};
        const raw = resolvePath(currentTranslations, key);

        if (raw === undefined || raw === null) {
            return fallback;
        }

        return formatValue(raw, params);
    };

    const applyTextTranslations = () => {
        document.querySelectorAll("[data-i18n]").forEach((element) => {
            const key = element.getAttribute("data-i18n");
            if (!key) {
                return;
            }

            const translated = getTranslation(key, null, "");
            if (translated !== "") {
                element.textContent = translated;
            }
        });

        document.querySelectorAll("[data-i18n-html]").forEach((element) => {
            const key = element.getAttribute("data-i18n-html");
            if (!key) {
                return;
            }

            const translated = getTranslation(key, null, "");
            if (translated !== "") {
                element.innerHTML = translated;
            }
        });

        document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
            const descriptor = element.getAttribute("data-i18n-attr");
            if (!descriptor) {
                return;
            }

            descriptor
                .split(";")
                .map((entry) => entry.trim())
                .filter(Boolean)
                .forEach((entry) => {
                    const [attrName, key] = entry.split(":").map((part) => part.trim());
                    if (!attrName || !key) {
                        return;
                    }

                    const translated = getTranslation(key, null, "");
                    if (translated !== "") {
                        element.setAttribute(attrName, translated);
                    }
                });
        });
    };

    const updateDocumentMeta = () => {
        const title = getTranslation("meta.title", null, "");
        if (title) {
            document.title = title;
        }
        document.documentElement.lang = state.activeLanguage;
    };

    const dispatchLanguageChange = () => {
        document.dispatchEvent(new CustomEvent("i18n:changed", {
            detail: {
                language: state.activeLanguage,
                translate: window.I18n.t
            }
        }));
    };

    const applyLanguage = (languageCode) => {
        if (!state.translations[languageCode]) {
            return;
        }

        state.activeLanguage = languageCode;
        safeStorage.set(state.config.storageKey, languageCode);

        applyTextTranslations();
        updateDocumentMeta();
        renderLanguageSwitcher();

        document.body.classList.remove("i18n-pending");
        document.body.classList.add("i18n-ready");

        dispatchLanguageChange();
    };

    const createLanguageSwitcher = () => {
        const wrapper = document.createElement("div");
        wrapper.className = "i18n-switcher";

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "i18n-switcher-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");

        const list = document.createElement("ul");
        list.className = "i18n-switcher-list";
        list.setAttribute("role", "listbox");

        wrapper.appendChild(trigger);
        wrapper.appendChild(list);
        document.body.appendChild(wrapper);

        trigger.addEventListener("click", () => {
            const expanded = trigger.getAttribute("aria-expanded") === "true";
            trigger.setAttribute("aria-expanded", expanded ? "false" : "true");
            wrapper.classList.toggle("open", !expanded);
        });

        document.addEventListener("click", (event) => {
            if (!wrapper.contains(event.target)) {
                wrapper.classList.remove("open");
                trigger.setAttribute("aria-expanded", "false");
            }
        });

        state.switcher = { wrapper, trigger, list };
    };

    const renderLanguageSwitcher = () => {
        if (!state.switcher) {
            createLanguageSwitcher();
        }

        const { wrapper, trigger, list } = state.switcher;
        const entries = Object.entries(state.languages);
        const activeLanguageMeta = state.languages[state.activeLanguage] || {};

        const switcherAria = getTranslation("i18n.switcherAria", null, "");
        const listAria = getTranslation("i18n.listAria", null, "");
        const getLanguageDisplay = (meta, code, mode) => {
            const flag = meta?.flag || "";
            const short = meta?.shortLabel || code.toUpperCase();
            const full = meta?.label || code.toUpperCase();

            if (mode === "trigger") {
                return short;
            }

            return flag ? `${flag} ${full}` : full;
        };

        trigger.setAttribute("aria-label", switcherAria);
        trigger.textContent = getLanguageDisplay(activeLanguageMeta, state.activeLanguage, "trigger");
        list.setAttribute("aria-label", listAria);

        list.innerHTML = "";

        entries.forEach(([code, meta]) => {
            const option = document.createElement("li");
            option.className = "i18n-switcher-item";

            const button = document.createElement("button");
            button.type = "button";
            button.className = "i18n-switcher-option";
            button.textContent = getLanguageDisplay(meta, code, "list");
            button.setAttribute("role", "option");
            button.setAttribute("aria-selected", code === state.activeLanguage ? "true" : "false");

            button.addEventListener("click", () => {
                applyLanguage(code);
                wrapper.classList.remove("open");
                trigger.setAttribute("aria-expanded", "false");
            });

            option.appendChild(button);
            list.appendChild(option);
        });
    };

    const getRequestedLanguage = () => {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get("lang");
        if (fromQuery && state.translations[fromQuery]) {
            return fromQuery;
        }

        const fromStorage = safeStorage.get(state.config.storageKey);
        if (fromStorage && state.translations[fromStorage]) {
            return fromStorage;
        }

        if (state.translations[config.defaultLanguage]) {
            return config.defaultLanguage;
        }

        return Object.keys(state.translations)[0] || "hu";
    };

    const loadPayload = async () => {
        if (window.location.protocol === "file:") {
            if (window.__I18N_PAYLOAD__ && typeof window.__I18N_PAYLOAD__ === "object") {
                return window.__I18N_PAYLOAD__;
            }
            throw new Error("Missing i18n payload for file:// mode. Load js/i18n-data.js before js/i18n.js.");
        }

        const candidates = [
            new URL(config.filePath, document.baseURI).href,
            config.filePath
        ];

        const uniqueCandidates = [...new Set(candidates)];
        let lastError = null;

        for (const url of uniqueCandidates) {
            try {
                const response = await fetch(url, { cache: "no-cache" });
                if (!response.ok) {
                    throw new Error(`Cannot load i18n file (${url}): ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error("Cannot load i18n file.");
    };

    const init = async () => {
        try {
            const payload = await loadPayload();

            state.config = {
                storageKey: payload.storageKey || "site.language"
            };
            state.languages = payload.languages || {};
            state.translations = payload.translations || {};

            const requestedLanguage = getRequestedLanguage();
            applyLanguage(requestedLanguage);
        } catch (error) {
            document.body.classList.remove("i18n-pending");
            document.body.classList.add("i18n-ready");
            console.error(error);
        }
    };

    window.I18n = {
        get language() {
            return state.activeLanguage;
        },
        t: (key, params, fallback = "") => getTranslation(key, params, fallback),
        setLanguage: (languageCode) => applyLanguage(languageCode)
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
