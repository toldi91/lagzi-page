(() => {
    const SECTION_SELECTOR = ".gallery-section";
    const GRID_SELECTOR = ".gallery-grid";
    const INIT_FLAG = "galleryFlowInitialized";
    const FLOW_CLASS = "gallery-flow";
    const VIEWPORT_CLASS = "gallery-flow__viewport";
    const TRACK_CLASS = "gallery-flow__track";
    const GROUP_CLASS = "gallery-flow__group";

    class GalleryFlow {
        constructor(section, options = {}) {
            this.section = section;
            this.grid = section.querySelector(GRID_SELECTOR);
            this.speed = Number(options.speed ?? section.dataset.gallerySpeed ?? 60);
            this.rafId = 0;
            this.lastFrame = 0;
            this.offset = 0;
            this.groupWidth = 0;
            this.destroyed = false;

            this.handleResize = this.handleResize.bind(this);
            this.tick = this.tick.bind(this);
        }

        init() {
            if (!this.section || !this.grid || this.section.dataset[INIT_FLAG] === "true") {
                return false;
            }

            if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
                return false;
            }

            const items = Array.from(this.grid.children).filter(node => node.tagName === "FIGURE");
            if (items.length < 2) {
                return false;
            }

            this.viewport = document.createElement("div");
            this.viewport.className = VIEWPORT_CLASS;

            this.track = document.createElement("div");
            this.track.className = TRACK_CLASS;

            this.group = document.createElement("div");
            this.group.className = GROUP_CLASS;

            this.items = items;
            items.forEach(item => this.group.appendChild(item));

            this.cloneGroup = this.group.cloneNode(true);
            this.cloneGroup.setAttribute("aria-hidden", "true");

            this.track.append(this.group, this.cloneGroup);
            this.viewport.appendChild(this.track);
            this.section.insertBefore(this.viewport, this.grid);
            this.grid.remove();
            this.section.classList.add(FLOW_CLASS);
            this.section.dataset[INIT_FLAG] = "true";

            this.refreshMeasurements();
            window.addEventListener("resize", this.handleResize, { passive: true });
            this.start();

            return true;
        }

        refreshMeasurements() {
            if (!this.group || !this.track) {
                return;
            }

            this.groupWidth = this.group.getBoundingClientRect().width;

            if (!this.groupWidth) {
                return;
            }

            this.offset = this.offset % this.groupWidth;
            this.applyTransform();
        }

        handleResize() {
            this.refreshMeasurements();
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
            if (this.destroyed || !this.groupWidth) {
                this.rafId = 0;
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
            window.removeEventListener("resize", this.handleResize);
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
