(() => {
    const SECTION_SELECTOR = ".gallery-section";
    const SOURCE_SELECTOR = ".gallery-source";
    const INIT_FLAG = "galleryFlowInitialized";

    const FLOW_CLASS = "gallery-flow";
    const VIEWPORT_CLASS = "gallery-flow__viewport";
    const TRACK_CLASS = "gallery-flow__track";
    const GROUP_CLASS = "gallery-flow__group";

    const DEFAULT_SPEED = 60;
    const MIN_SPEED = 1;
    const MAX_DT_MS = 120;

    class GalleryFlow {
        constructor(section, options = {}) {
            this.section = section;
            this.source = section?.querySelector(SOURCE_SELECTOR) ?? null;
            this.speed = this.resolveSpeed(options.speed ?? section?.dataset?.gallerySpeed);

            this.viewport = null;
            this.track = null;
            this.baseGroup = null;
            this.groups = [];

            this.groupWidth = 0;
            this.offset = 0;

            this.rafId = 0;
            this.lastTime = 0;
            this.refreshQueued = false;
            this.destroyed = false;
            this.initialized = false;
            this.inViewport = true;

            this.resizeObserver = null;
            this.intersectionObserver = null;
            this.mediaReduceMotion = null;
            this.useLeftPosition = false;

            this.handleResize = this.handleResize.bind(this);
            this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
            this.handleReduceMotionChange = this.handleReduceMotionChange.bind(this);
            this.handleResizeObserved = this.handleResizeObserved.bind(this);
            this.handleIntersection = this.handleIntersection.bind(this);
            this.tick = this.tick.bind(this);
        }

        resolveSpeed(rawSpeed) {
            const parsed = Number(rawSpeed);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                return DEFAULT_SPEED;
            }
            return Math.max(MIN_SPEED, parsed);
        }

        init() {
            if (!this.section || !this.source || this.initialized || this.destroyed) {
                return false;
            }

            if (this.section.dataset[INIT_FLAG] === "true") {
                return false;
            }

            const reduceMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
            this.mediaReduceMotion = reduceMotionQuery;

            const figures = Array.from(this.source.content?.children ?? []).filter(node => node.tagName === "FIGURE");
            if (figures.length < 2) {
                return false;
            }

            const ua = navigator.userAgent || "";
            const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
            this.useLeftPosition = isIOSDevice;

            this.viewport = document.createElement("div");
            this.viewport.className = VIEWPORT_CLASS;

            this.track = document.createElement("div");
            this.track.className = TRACK_CLASS;

            this.baseGroup = document.createElement("div");
            this.baseGroup.className = GROUP_CLASS;

            for (const figure of figures) {
                this.baseGroup.appendChild(figure.cloneNode(true));
            }

            this.track.appendChild(this.baseGroup);
            this.viewport.appendChild(this.track);
            this.section.insertBefore(this.viewport, this.source);

            this.source.remove();
            this.section.classList.add(FLOW_CLASS);
            this.section.dataset[INIT_FLAG] = "true";

            this.bindEvents();
            this.attachImageLoadListeners();
            this.refreshMeasurements();

            this.initialized = true;
            this.start();
            return true;
        }

        bindEvents() {
            window.addEventListener("resize", this.handleResize, { passive: true });
            document.addEventListener("visibilitychange", this.handleVisibilityChange);

            if (this.mediaReduceMotion) {
                if (typeof this.mediaReduceMotion.addEventListener === "function") {
                    this.mediaReduceMotion.addEventListener("change", this.handleReduceMotionChange);
                } else if (typeof this.mediaReduceMotion.addListener === "function") {
                    this.mediaReduceMotion.addListener(this.handleReduceMotionChange);
                }
            }

            if ("ResizeObserver" in window) {
                this.resizeObserver = new ResizeObserver(this.handleResizeObserved);
                if (this.viewport) {
                    this.resizeObserver.observe(this.viewport);
                }
                if (this.baseGroup) {
                    this.resizeObserver.observe(this.baseGroup);
                }
            }

            if ("IntersectionObserver" in window) {
                this.intersectionObserver = new IntersectionObserver(this.handleIntersection, {
                    root: null,
                    threshold: 0
                });

                if (this.section) {
                    this.intersectionObserver.observe(this.section);
                }
            }
        }

        attachImageLoadListeners() {
            if (!this.baseGroup) {
                return;
            }

            const images = this.baseGroup.querySelectorAll("img");
            for (const image of images) {
                if (image.complete) {
                    continue;
                }

                image.addEventListener("load", this.handleResize, { once: true });
                image.addEventListener("error", this.handleResize, { once: true });
            }
        }

        handleResize() {
            this.queueRefresh();
        }

        handleResizeObserved() {
            this.queueRefresh();
        }

        handleIntersection(entries) {
            const entry = entries[0];
            if (!entry || this.destroyed) {
                return;
            }

            this.inViewport = entry.isIntersecting || entry.intersectionRatio > 0;

            if (this.inViewport) {
                this.start();
            } else {
                this.stop();
            }
        }

        handleVisibilityChange() {
            if (this.destroyed) {
                return;
            }

            if (document.hidden) {
                this.stop();
                return;
            }

            this.lastTime = performance.now();
            this.queueRefresh();
            this.start();
        }

        handleReduceMotionChange(event) {
            if (this.destroyed) {
                return;
            }

            if (event.matches) {
                this.stop();
            } else {
                this.lastTime = performance.now();
                this.start();
            }
        }

        queueRefresh() {
            if (this.destroyed || this.refreshQueued) {
                return;
            }

            this.refreshQueued = true;
            window.requestAnimationFrame(() => {
                this.refreshQueued = false;
                if (this.destroyed) {
                    return;
                }
                this.refreshMeasurements();
            });
        }

        refreshMeasurements() {
            if (!this.viewport || !this.track || !this.baseGroup) {
                return;
            }

            const width = this.measureGroupWidth();
            if (!width || !Number.isFinite(width)) {
                this.groupWidth = 0;
                return;
            }

            this.groupWidth = width;
            this.syncGroupCount();

            this.offset = this.normalizeOffset(this.offset);
            this.applyTransform();

            if (!this.rafId && this.shouldAnimate()) {
                this.start();
            }
        }

        measureGroupWidth() {
            if (!this.baseGroup) {
                return 0;
            }

            const cards = Array.from(this.baseGroup.children);
            if (!cards.length) {
                return 0;
            }

            const styles = window.getComputedStyle(this.baseGroup);
            const gapValue = styles.columnGap || styles.gap || "0";
            const gap = Number.parseFloat(gapValue) || 0;

            const cardsWidth = cards.reduce((sum, card) => {
                const rect = card.getBoundingClientRect();
                const width = rect.width || card.offsetWidth || 0;
                return sum + width;
            }, 0);

            const byChildren = cardsWidth + gap * Math.max(0, cards.length - 1);
            const byRects = Math.max(
                this.baseGroup.getBoundingClientRect().width || 0,
                this.baseGroup.scrollWidth || 0,
                this.baseGroup.offsetWidth || 0
            );

            const measured = byChildren > 0 ? byChildren : byRects;
            return measured > 0 ? measured : 0;
        }

        syncGroupCount() {
            if (!this.viewport || !this.track || !this.baseGroup || !this.groupWidth) {
                return;
            }

            this.baseGroup.style.width = `${this.groupWidth}px`;

            const viewportWidth = this.viewport.clientWidth || this.viewport.getBoundingClientRect().width || 0;
            const minimumTrackWidth = viewportWidth + this.groupWidth * 2;
            const neededGroups = Math.max(3, Math.ceil(minimumTrackWidth / this.groupWidth) + 1);

            while (this.track.children.length < neededGroups) {
                const clone = this.baseGroup.cloneNode(true);
                clone.setAttribute("aria-hidden", "true");
                this.track.appendChild(clone);
            }

            while (this.track.children.length > neededGroups) {
                this.track.removeChild(this.track.lastElementChild);
            }

            this.groups = Array.from(this.track.children);
            this.groups.forEach(group => {
                group.style.width = `${this.groupWidth}px`;
                group.style.flex = `0 0 ${this.groupWidth}px`;
            });
            this.track.style.width = `${this.groups.length * this.groupWidth}px`;
        }

        normalizeOffset(value) {
            if (!this.groupWidth) {
                return 0;
            }

            let next = value % this.groupWidth;
            if (next < 0) {
                next += this.groupWidth;
            }
            return next;
        }

        applyTransform() {
            if (!this.track) {
                return;
            }

            if (this.useLeftPosition) {
                this.track.style.transform = "none";
                this.track.style.webkitTransform = "none";
                this.track.style.left = `${-this.offset}px`;
                return;
            }

            this.track.style.left = "0px";
            this.track.style.transform = `translate3d(${-this.offset}px, 0, 0)`;
            this.track.style.webkitTransform = this.track.style.transform;
        }

        shouldAnimate() {
            if (!this.groupWidth || this.destroyed || document.hidden) {
                return false;
            }

            if (this.mediaReduceMotion?.matches) {
                return false;
            }

            if (this.intersectionObserver && !this.inViewport) {
                return false;
            }

            return true;
        }

        start() {
            if (this.rafId || !this.shouldAnimate()) {
                return;
            }

            this.lastTime = performance.now();
            this.rafId = window.requestAnimationFrame(this.tick);
        }

        stop() {
            if (!this.rafId) {
                return;
            }

            window.cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }

        tick(now) {
            if (this.destroyed) {
                this.rafId = 0;
                return;
            }

            if (!this.shouldAnimate()) {
                this.stop();
                return;
            }

            const delta = Math.min(MAX_DT_MS, Math.max(0, now - this.lastTime));
            this.lastTime = now;

            this.offset = this.normalizeOffset(this.offset + (this.speed * delta) / 1000);
            this.applyTransform();

            this.rafId = window.requestAnimationFrame(this.tick);
        }

        destroy() {
            if (this.destroyed) {
                return;
            }

            this.destroyed = true;
            this.stop();

            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }

            if (this.intersectionObserver) {
                this.intersectionObserver.disconnect();
                this.intersectionObserver = null;
            }

            if (this.mediaReduceMotion) {
                if (typeof this.mediaReduceMotion.removeEventListener === "function") {
                    this.mediaReduceMotion.removeEventListener("change", this.handleReduceMotionChange);
                } else if (typeof this.mediaReduceMotion.removeListener === "function") {
                    this.mediaReduceMotion.removeListener(this.handleReduceMotionChange);
                }
            }

            window.removeEventListener("resize", this.handleResize);
            document.removeEventListener("visibilitychange", this.handleVisibilityChange);

            this.groups = [];
        }
    }

    const instances = new WeakMap();

    const collectSections = root => {
        const sections = [];

        if (root?.matches?.(SECTION_SELECTOR)) {
            sections.push(root);
        }

        const nested = root?.querySelectorAll?.(SECTION_SELECTOR) ?? [];
        for (const section of nested) {
            sections.push(section);
        }

        return sections;
    };

    const initGalleryFlow = (root = document) => {
        for (const section of collectSections(root)) {
            if (instances.has(section)) {
                continue;
            }

            const instance = new GalleryFlow(section);
            if (instance.init()) {
                instances.set(section, instance);
            }
        }
    };

    const boot = () => initGalleryFlow(document);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }

    window.GalleryFlow = {
        init: initGalleryFlow,
        GalleryFlow
    };
})();
