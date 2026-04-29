(() => {
    const SECTION_SELECTOR = ".gallery-section";
    const SOURCE_SELECTOR = ".gallery-source";
    const INIT_FLAG = "galleryFlowInitialized";
    const FLOW_CLASS = "gallery-flow";
    const VIEWPORT_CLASS = "gallery-flow__viewport";
    const TRACK_CLASS = "gallery-flow__track";
    const GROUP_CLASS = "gallery-flow__group";

    class GalleryFlow {
        constructor(section, options = {}) {
            this.section = section;
            this.source = section.querySelector(SOURCE_SELECTOR);
            this.speed = Number(options.speed ?? section.dataset.gallerySpeed ?? 60);
            this.rafId = 0;
            this.lastFrame = 0;
            this.offset = 0;
            this.groupWidth = 0;
            this.destroyed = false;
            this.retryScheduled = false;
            this.refreshQueued = false;
            this.resizeObserver = null;

            this.handleResize = this.handleResize.bind(this);
            this.handleLoad = this.handleLoad.bind(this);
            this.handleObservedResize = this.handleObservedResize.bind(this);
            this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
            this.tick = this.tick.bind(this);
        }

        init() {
            if (!this.section || !this.source || this.section.dataset[INIT_FLAG] === "true") {
                return false;
            }

            if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
                return false;
            }

            const items = Array.from(this.source.content.children).filter(node => node.tagName === "FIGURE");
            if (items.length < 2) {
                return false;
            }

            this.viewport = document.createElement("div");
            this.viewport.className = VIEWPORT_CLASS;

            this.track = document.createElement("div");
            this.track.className = TRACK_CLASS;

            this.group = document.createElement("div");
            this.group.className = GROUP_CLASS;

            this.items = items.map(item => item.cloneNode(true));
            this.items.forEach(item => this.group.appendChild(item));

            this.clonedGroups = [this.group];
            for (let i = 0; i < 2; i += 1) {
                const cloneGroup = this.group.cloneNode(true);
                cloneGroup.setAttribute("aria-hidden", "true");
                this.clonedGroups.push(cloneGroup);
            }

            this.track.append(...this.clonedGroups);
            this.viewport.appendChild(this.track);
            this.section.insertBefore(this.viewport, this.source);

            this.refreshMeasurements();
            if (!this.groupWidth) {
                this.viewport.remove();
                if (!this.retryScheduled) {
                    this.retryScheduled = true;
                    window.addEventListener("load", this.handleLoad, { once: true });
                }
                return false;
            }

            this.source.remove();
            this.section.classList.add(FLOW_CLASS);
            this.section.dataset[INIT_FLAG] = "true";

            window.addEventListener("resize", this.handleResize, { passive: true });
            document.addEventListener("visibilitychange", this.handleVisibilityChange);
            if ("ResizeObserver" in window) {
                this.resizeObserver = new ResizeObserver(this.handleObservedResize);
                this.resizeObserver.observe(this.viewport);
                this.resizeObserver.observe(this.group);
            }
            this.start();

            return true;
        }

        refreshMeasurements() {
            if (!this.group || !this.track) {
                return;
            }

            const previousWidth = this.groupWidth;
            const rectWidth = this.group.getBoundingClientRect().width;
            const offsetWidth = this.group.offsetWidth;
            const scrollWidth = this.group.scrollWidth;
            this.groupWidth = Math.max(rectWidth, offsetWidth, scrollWidth);

            if (!this.groupWidth) {
                return;
            }

            this.offset = this.offset % this.groupWidth;
            this.applyTransform();

            if ((!previousWidth || !this.rafId) && !this.destroyed) {
                this.start();
            }
        }

        handleResize() {
            this.queueRefresh();
        }

        handleLoad() {
            if (this.destroyed) {
                return;
            }

            this.retryScheduled = false;
            this.init();
        }

        handleObservedResize() {
            this.queueRefresh();
        }

        handleVisibilityChange() {
            if (this.destroyed || document.hidden) {
                return;
            }

            this.lastFrame = performance.now();
            this.queueRefresh();
            this.start();
        }

        queueRefresh() {
            if (this.destroyed || this.refreshQueued) {
                return;
            }

            this.refreshQueued = true;
            window.requestAnimationFrame(() => {
                if (this.destroyed) {
                    this.refreshQueued = false;
                    return;
                }
                this.refreshQueued = false;
                this.refreshMeasurements();
            });
        }

        applyTransform() {
            if (!this.track) {
                return;
            }

            this.track.style.transform = `translate3d(${-this.offset}px, 0, 0)`;
        }

        start() {
            if (this.rafId || this.destroyed || !this.groupWidth) {
                return;
            }

            this.lastFrame = performance.now();
            this.rafId = window.requestAnimationFrame(this.tick);
        }

        stop() {
            if (this.rafId) {
                window.cancelAnimationFrame(this.rafId);
                this.rafId = 0;
            }
        }

        tick(now) {
            if (this.destroyed) {
                this.rafId = 0;
                return;
            }

            if (!this.groupWidth) {
                this.lastFrame = now;
                this.queueRefresh();
                this.rafId = window.requestAnimationFrame(this.tick);
                return;
            }

            const elapsed = Math.max(0, now - this.lastFrame);
            this.lastFrame = now;
            this.offset = (this.offset + (this.speed * elapsed) / 1000) % this.groupWidth;
            this.applyTransform();
            this.rafId = window.requestAnimationFrame(this.tick);
        }

        destroy() {
            this.destroyed = true;
            this.stop();
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            window.removeEventListener("resize", this.handleResize);
            window.removeEventListener("load", this.handleLoad);
            document.removeEventListener("visibilitychange", this.handleVisibilityChange);
        }
    }

    const instances = new WeakMap();

    const initGalleryFlow = (root = document) => {
        const sections = [];

        if (root.matches?.(SECTION_SELECTOR)) {
            sections.push(root);
        }

        const nestedSections = root.querySelectorAll?.(SECTION_SELECTOR) ?? [];
        nestedSections.forEach(section => sections.push(section));

        sections.forEach(section => {
            if (instances.has(section)) {
                return;
            }

            const instance = new GalleryFlow(section);
            if (instance.init()) {
                instances.set(section, instance);
            }
        });
    };

    const boot = () => initGalleryFlow();

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
