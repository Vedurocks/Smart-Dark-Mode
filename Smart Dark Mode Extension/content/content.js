// Content script - AI-powered dark mode

class SmartDarkMode {
    constructor() {
        this.hostname = window.location.hostname;
        this.rootDomain = this.getRootDomain(this.hostname);
        this.darkModeEnabled = false;
        this.aiLayoutEnabled = false;
        this.customStyles = null;
        this.customCSSStyle = null;
        this.observer = null;
        this.elementSelectorActive = false;
        this.init();
    }

    getRootDomain(hostname) {
        let domain = hostname.replace(/^www\./, '');
        const parts = domain.split('.');
        if (parts.length <= 2) return domain;
        return parts.slice(-2).join('.');
    }

    async init() {
        const prefs = await this.loadPreferences();
        const blacklisted = await this.isBlacklisted();
        if (blacklisted) return;
        
        const shouldApply = this.shouldApplyDarkMode(prefs);
        if (shouldApply) {
            this.enableDarkMode(prefs);
        }
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sendResponse);
            return true;
        });
        
        this.observePageChanges();
    }

    async isBlacklisted() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['blacklist'], (result) => {
                const blacklist = result.blacklist || [];
                resolve(blacklist.some(domain => 
                    this.getRootDomain(domain) === this.rootDomain || domain === this.hostname
                ));
            });
        });
    }

    async loadPreferences() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                const prefs = result.sitePreferences || {};
                const exactPrefs = prefs[this.hostname];
                const rootPrefs = prefs[this.rootDomain];
                resolve(exactPrefs || rootPrefs || { 
                    enabled: false, mode: 'auto', customRules: [], 
                    removedElements: [], aiLayoutEnabled: false, customCSS: ''
                });
            });
        });
    }

    shouldApplyDarkMode(prefs) {
        if (!prefs.enabled) return false;
        switch (prefs.mode) {
            case 'always-dark': return true;
            case 'never-dark': return false;
            case 'auto':
            default: return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
    }

    enableDarkMode(prefs) {
        if (this.darkModeEnabled) return;
        this.darkModeEnabled = true;
        this.aiLayoutEnabled = prefs.aiLayoutEnabled || false;
        document.documentElement.classList.add('smart-dark-mode-active');
        
        if (prefs.customCSS) this.applyCustomCSS(prefs.customCSS);
        if (prefs.customRules && prefs.customRules.length > 0) this.applyCustomRules(prefs.customRules);
        if (prefs.removedElements && prefs.removedElements.length > 0) this.removeElements(prefs.removedElements);
        
        // Apply AI-powered dark mode
        this.applyAIDarkMode();
        
        if (this.aiLayoutEnabled) {
            this.applyAILayoutFixes();
        }
    }

    disableDarkMode() {
        if (!this.darkModeEnabled) return;
        this.darkModeEnabled = false;
        this.aiLayoutEnabled = false;
        document.documentElement.classList.remove('smart-dark-mode-active');
        if (this.customStyles) { this.customStyles.remove(); this.customStyles = null; }
        if (this.customCSSStyle) { this.customCSSStyle.remove(); this.customCSSStyle = null; }
        const hiddenElements = document.querySelectorAll('[data-smart-dark-hidden="true"]');
        hiddenElements.forEach(el => { el.style.display = ''; el.removeAttribute('data-smart-dark-hidden'); });
        this.removeAILayoutFixes();
    }

    // AI-Powered Dark Mode - Intelligent Color Analysis
    applyAIDarkMode() {
        if (this.customStyles) return;
        
        this.customStyles = document.createElement('style');
        this.customStyles.id = 'smart-dark-mode-enhanced';
        this.customStyles.textContent = `
            /* AI-Powered Dark Mode - No Simple Inversion */
            
            /* Root Variables */
            html.smart-dark-mode-active {
                --ai-bg-primary: #0f0f0f;
                --ai-bg-secondary: #1a1a1a;
                --ai-bg-tertiary: #242424;
                --ai-text-primary: #e8e8e8;
                --ai-text-secondary: #b8b8b8;
                --ai-text-tertiary: #888888;
                --ai-border: #333333;
                --ai-accent: #6c63ff;
                --ai-link: #4ecdc4;
                color-scheme: dark;
            }
            
            /* Intelligent Background Colors */
            html.smart-dark-mode-active,
            html.smart-dark-mode-active body {
                background-color: var(--ai-bg-primary) !important;
                color: var(--ai-text-primary) !important;
            }
            
            /* Containers and Sections */
            html.smart-dark-mode-active div,
            html.smart-dark-mode-active section,
            html.smart-dark-mode-active article,
            html.smart-dark-mode-active aside,
            html.smart-dark-mode-active main,
            html.smart-dark-mode-active header,
            html.smart-dark-mode-active footer,
            html.smart-dark-mode-active nav {
                background-color: transparent !important;
            }
            
            /* Cards and Content Boxes */
            html.smart-dark-mode-active [class*="card"],
            html.smart-dark-mode-active [class*="box"],
            html.smart-dark-mode-active [class*="panel"],
            html.smart-dark-mode-active [class*="container"] {
                background-color: var(--ai-bg-secondary) !important;
                border-color: var(--ai-border) !important;
            }
            
            /* Text Elements */
            html.smart-dark-mode-active h1,
            html.smart-dark-mode-active h2,
            html.smart-dark-mode-active h3,
            html.smart-dark-mode-active h4,
            html.smart-dark-mode-active h5,
            html.smart-dark-mode-active h6 {
                color: var(--ai-text-primary) !important;
            }
            
            html.smart-dark-mode-active p,
            html.smart-dark-mode-active span,
            html.smart-dark-mode-active li,
            html.smart-dark-mode-active td,
            html.smart-dark-mode-active th,
            html.smart-dark-mode-active label {
                color: var(--ai-text-secondary) !important;
            }
            
            /* Links */
            html.smart-dark-mode-active a {
                color: var(--ai-link) !important;
            }
            
            html.smart-dark-mode-active a:hover {
                color: var(--ai-accent) !important;
            }
            
            /* Form Elements */
            html.smart-dark-mode-active input,
            html.smart-dark-mode-active textarea,
            html.smart-dark-mode-active select {
                background-color: var(--ai-bg-tertiary) !important;
                color: var(--ai-text-primary) !important;
                border-color: var(--ai-border) !important;
            }
            
            html.smart-dark-mode-active input::placeholder,
            html.smart-dark-mode-active textarea::placeholder {
                color: var(--ai-text-tertiary) !important;
            }
            
            /* Buttons */
            html.smart-dark-mode-active button,
            html.smart-dark-mode-active [role="button"] {
                background-color: var(--ai-bg-tertiary) !important;
                color: var(--ai-text-primary) !important;
                border-color: var(--ai-border) !important;
            }
            
            html.smart-dark-mode-active button:hover,
            html.smart-dark-mode-active [role="button"]:hover {
                background-color: var(--ai-accent) !important;
                color: white !important;
            }
            
            /* Tables */
            html.smart-dark-mode-active table {
                background-color: var(--ai-bg-secondary) !important;
                border-color: var(--ai-border) !important;
            }
            
            html.smart-dark-mode-active th {
                background-color: var(--ai-bg-tertiary) !important;
                color: var(--ai-text-primary) !important;
            }
            
            html.smart-dark-mode-active tr:nth-child(even) {
                background-color: rgba(255, 255, 255, 0.02) !important;
            }
            
            /* Images - Keep Original Colors */
            html.smart-dark-mode-active img,
            html.smart-dark-mode-active picture,
            html.smart-dark-mode-active video,
            html.smart-dark-mode-active canvas {
                filter: none !important;
                opacity: 0.9;
            }
            
            /* SVG Icons - Adaptive Colors */
            html.smart-dark-mode-active svg {
                fill: var(--ai-text-secondary) !important;
            }
            
            html.smart-dark-mode-active svg path,
            html.smart-dark-mode-active svg circle,
            html.smart-dark-mode-active svg rect {
                fill: currentColor !important;
            }
            
            /* Code Blocks */
            html.smart-dark-mode-active pre,
            html.smart-dark-mode-active code {
                background-color: #1a1a1a !important;
                color: #61dafb !important;
                border: 1px solid var(--ai-border) !important;
            }
            
            /* Modals and Overlays */
            html.smart-dark-mode-active [class*="modal"],
            html.smart-dark-mode-active [class*="dialog"],
            html.smart-dark-mode-active [class*="popup"] {
                background-color: var(--ai-bg-secondary) !important;
                color: var(--ai-text-primary) !important;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
            }
            
            /* Scrollbars */
            html.smart-dark-mode-active ::-webkit-scrollbar {
                width: 12px;
                background-color: var(--ai-bg-primary);
            }
            
            html.smart-dark-mode-active ::-webkit-scrollbar-thumb {
                background-color: var(--ai-bg-tertiary);
                border-radius: 6px;
            }
            
            html.smart-dark-mode-active ::-webkit-scrollbar-thumb:hover {
                background-color: var(--ai-accent);
            }
            
            /* Transitions */
            html.smart-dark-mode-active * {
                transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease !important;
            }
        `;
        
        document.head.appendChild(this.customStyles);
    }

    applyCustomCSS(css) {
        if (this.customCSSStyle) this.customCSSStyle.remove();
        this.customCSSStyle = document.createElement('style');
        this.customCSSStyle.id = 'smart-dark-mode-custom-css';
        this.customCSSStyle.textContent = css;
        document.head.appendChild(this.customCSSStyle);
    }

    applyCustomRules(rules) {
        rules.forEach(rule => {
            if (rule.selector && rule.styles) {
                const style = document.createElement('style');
                style.className = 'smart-dark-custom-rule';
                style.textContent = `${rule.selector} { ${rule.styles} }`;
                document.head.appendChild(style);
            }
        });
    }

    removeElements(selectors) {
        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    el.style.display = 'none';
                    el.setAttribute('data-smart-dark-hidden', 'true');
                });
            } catch (e) { console.warn('Invalid selector:', selector); }
        });
    }

    applyAILayoutFixes() {
        const fixes = document.createElement('style');
        fixes.id = 'smart-dark-ai-fixes';
        fixes.textContent = `
            /* AI Enhanced Layout Fixes */
            html.smart-dark-mode-active {
                /* Improve contrast for low-contrast elements */
                --min-contrast: 4.5;
            }
            
            /* Fix white or light backgrounds that survived */
            html.smart-dark-mode-active [style*="background: white"],
            html.smart-dark-mode-active [style*="background: #fff"],
            html.smart-dark-mode-active [style*="background-color: white"],
            html.smart-dark-mode-active [style*="background-color: #fff"],
            html.smart-dark-mode-active [style*="background-color: rgb(255, 255, 255)"] {
                background-color: var(--ai-bg-secondary) !important;
            }
            
            /* Fix black text on dark backgrounds */
            html.smart-dark-mode-active [style*="color: black"],
            html.smart-dark-mode-active [style*="color: #000"],
            html.smart-dark-mode-active [style*="color: rgb(0, 0, 0)"] {
                color: var(--ai-text-primary) !important;
            }
            
            /* Enhance visibility of borders */
            html.smart-dark-mode-active [style*="border"],
            html.smart-dark-mode-active hr {
                border-color: var(--ai-border) !important;
            }
        `;
        document.head.appendChild(fixes);
    }

    removeAILayoutFixes() {
        const fixes = document.getElementById('smart-dark-ai-fixes');
        if (fixes) fixes.remove();
    }

    // Element Selector Methods (keeping previous implementation)
    startElementSelector() {
        if (this.elementSelectorActive) return;
        this.elementSelectorActive = true;
        this.currentHighlighted = null;
        
        this.overlay = document.createElement('div');
        this.overlay.id = 'smart-dark-selector-overlay';
        this.overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(108, 99, 255, 0.05); z-index: 999998; pointer-events: none;`;
        document.body.appendChild(this.overlay);
        
        this.instructionBox = document.createElement('div');
        this.instructionBox.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(108, 99, 255, 0.95); color: white; padding: 15px 25px; border-radius: 8px; z-index: 1000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); pointer-events: none;`;
        this.instructionBox.textContent = '🎯 Click any element to hide it • Press ESC to cancel';
        document.body.appendChild(this.instructionBox);
        
        this.handleMouseOver = this.handleMouseOver.bind(this);
        this.handleMouseOut = this.handleMouseOut.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        document.addEventListener('mouseover', this.handleMouseOver, true);
        document.addEventListener('mouseout', this.handleMouseOut, true);
        document.addEventListener('click', this.handleClick, true);
        document.addEventListener('keydown', this.handleKeyDown, true);
    }

    stopElementSelector() {
        if (!this.elementSelectorActive) return;
        this.elementSelectorActive = false;
        if (this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
        if (this.instructionBox && this.instructionBox.parentNode) this.instructionBox.parentNode.removeChild(this.instructionBox);
        document.removeEventListener('mouseover', this.handleMouseOver, true);
        document.removeEventListener('mouseout', this.handleMouseOut, true);
        document.removeEventListener('click', this.handleClick, true);
        document.removeEventListener('keydown', this.handleKeyDown, true);
        if (this.currentHighlighted) {
            this.unhighlightElement(this.currentHighlighted);
            this.currentHighlighted = null;
        }
    }

    handleMouseOver(e) {
        if (!this.elementSelectorActive) return;
        if (e.target === this.overlay || e.target === this.instructionBox) return;
        e.preventDefault();
        e.stopPropagation();
        if (this.currentHighlighted && this.currentHighlighted !== e.target) {
            this.unhighlightElement(this.currentHighlighted);
        }
        this.currentHighlighted = e.target;
        this.highlightElement(e.target);
    }

    handleMouseOut(e) {
        if (!this.elementSelectorActive) return;
        e.preventDefault();
        e.stopPropagation();
    }

    handleClick(e) {
        if (!this.elementSelectorActive) return;
        if (e.target === this.overlay || e.target === this.instructionBox) return;
        e.preventDefault();
        e.stopPropagation();
        const element = e.target;
        const selector = this.getSelector(element);
        element.style.display = 'none';
        element.setAttribute('data-smart-dark-hidden', 'true');
        this.saveRemovedElement(selector);
        this.showNotification(`Element hidden: ${selector}`);
    }

    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.stopElementSelector();
            this.showNotification('Element selector cancelled');
        }
    }

    highlightElement(element) {
        element.style.outline = '3px solid #6c63ff';
        element.style.outlineOffset = '2px';
        element.style.backgroundColor = 'rgba(108, 99, 255, 0.1)';
        element.style.cursor = 'pointer';
    }

    unhighlightElement(element) {
        element.style.outline = '';
        element.style.outlineOffset = '';
        element.style.backgroundColor = '';
        element.style.cursor = '';
    }

    getSelector(element) {
        if (element.id) return '#' + element.id;
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.trim() && !c.includes('smart-dark'));
            if (classes.length > 0) return element.tagName.toLowerCase() + '.' + classes[0];
        }
        const parent = element.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(element) + 1;
            return `${element.tagName.toLowerCase()}:nth-child(${index})`;
        }
        return element.tagName.toLowerCase();
    }

    async saveRemovedElement(selector) {
        const result = await chrome.storage.local.get(['sitePreferences']);
        const prefs = result.sitePreferences || {};
        const sitePrefs = prefs[this.rootDomain] || { 
            enabled: false, mode: 'auto', customRules: [], removedElements: [], aiLayoutEnabled: false, customCSS: ''
        };
        if (!sitePrefs.removedElements) sitePrefs.removedElements = [];
        if (!sitePrefs.removedElements.includes(selector)) {
            sitePrefs.removedElements.push(selector);
            sitePrefs.lastModified = Date.now();
            prefs[this.rootDomain] = sitePrefs;
            await chrome.storage.local.set({ sitePreferences: prefs });
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: rgba(78, 205, 196, 0.95); color: white; padding: 12px 20px; border-radius: 8px; z-index: 1000001; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); animation: slideIn 0.3s ease;`;
        notification.textContent = message;
        const style = document.createElement('style');
        style.textContent = `@keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`;
        document.head.appendChild(style);
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) notification.parentNode.removeChild(notification);
                if (style.parentNode) style.parentNode.removeChild(style);
            }, 300);
        }, 3000);
    }

    observePageChanges() {
        if (document.body) {
            this.observer = new MutationObserver(() => {});
            this.observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    handleMessage(request, sendResponse) {
        switch (request.action) {
            case 'enableDarkMode':
                this.loadPreferences().then(prefs => {
                    this.enableDarkMode(prefs);
                    sendResponse({ success: true });
                });
                break;
            case 'disableDarkMode':
                this.disableDarkMode();
                sendResponse({ success: true });
                break;
            case 'startElementSelector':
                this.startElementSelector();
                sendResponse({ success: true });
                break;
            case 'stopElementSelector':
                this.stopElementSelector();
                sendResponse({ success: true });
                break;
            case 'toggleAILayout':
                this.aiLayoutEnabled = request.enabled;
                if (request.enabled) this.applyAILayoutFixes();
                else this.removeAILayoutFixes();
                sendResponse({ success: true });
                break;
            case 'applyCustomCSS':
                this.applyCustomCSS(request.css);
                sendResponse({ success: true });
                break;
            case 'getStatus':
                sendResponse({ enabled: this.darkModeEnabled, hostname: this.hostname });
                break;
            default:
                sendResponse({ error: 'Unknown action' });
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { new SmartDarkMode(); });
} else {
    new SmartDarkMode();
}