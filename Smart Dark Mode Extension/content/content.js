/// Content script - runs on every webpage

class SmartDarkMode {
    constructor() {
        this.hostname = window.location.hostname;
        this.darkModeEnabled = false;
        this.aiLayoutEnabled = false;
        this.customStyles = null;
        this.customCSSStyle = null;
        this.observer = null;
        this.elementSelectorActive = false;
        this.init();
    }

    async init() {
        // Load preferences for this site
        const prefs = await this.loadPreferences();
        
        // Check if site is blacklisted
        const blacklisted = await this.isBlacklisted();
        if (blacklisted) {
            return; // Don't do anything on blacklisted sites
        }
        
        // Determine if dark mode should be applied
        const shouldApply = this.shouldApplyDarkMode(prefs);
        
        if (shouldApply) {
            this.enableDarkMode(prefs);
        }
        
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sendResponse);
            return true;
        });
        
        // Watch for dynamic content changes
        this.observePageChanges();
    }

    async isBlacklisted() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['blacklist'], (result) => {
                const blacklist = result.blacklist || [];
                resolve(blacklist.includes(this.hostname));
            });
        });
    }

    async loadPreferences() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                const prefs = result.sitePreferences || {};
                resolve(prefs[this.hostname] || { 
                    enabled: false,
                    mode: 'auto', 
                    customRules: [], 
                    removedElements: [],
                    aiLayoutEnabled: false,
                    customCSS: ''
                });
            });
        });
    }

    shouldApplyDarkMode(prefs) {
        if (!prefs.enabled) return false;
        
        switch (prefs.mode) {
            case 'always-dark':
                return true;
            case 'never-dark':
                return false;
            case 'auto':
            default:
                return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
    }

    enableDarkMode(prefs) {
        if (this.darkModeEnabled) return;
        
        this.darkModeEnabled = true;
        this.aiLayoutEnabled = prefs.aiLayoutEnabled || false;
        document.documentElement.classList.add('smart-dark-mode-active');
        
        // Apply custom CSS first
        if (prefs.customCSS) {
            this.applyCustomCSS(prefs.customCSS);
        }
        
        // Apply custom rules if any
        if (prefs.customRules && prefs.customRules.length > 0) {
            this.applyCustomRules(prefs.customRules);
        }
        
        // Remove specified elements if any
        if (prefs.removedElements && prefs.removedElements.length > 0) {
            this.removeElements(prefs.removedElements);
        }
        
        // Inject enhanced dark mode styles
        this.injectEnhancedStyles();
        
        // Apply AI layout fixes if enabled
        if (this.aiLayoutEnabled) {
            this.applyAILayoutFixes();
        }
    }

    disableDarkMode() {
        if (!this.darkModeEnabled) return;
        
        this.darkModeEnabled = false;
        this.aiLayoutEnabled = false;
        document.documentElement.classList.remove('smart-dark-mode-active');
        
        // Remove custom styles
        if (this.customStyles) {
            this.customStyles.remove();
            this.customStyles = null;
        }
        
        // Remove custom CSS
        if (this.customCSSStyle) {
            this.customCSSStyle.remove();
            this.customCSSStyle = null;
        }
        
        // Restore removed elements
        const hiddenElements = document.querySelectorAll('[data-smart-dark-hidden="true"]');
        hiddenElements.forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-smart-dark-hidden');
        });
        
        // Remove AI layout fixes
        this.removeAILayoutFixes();
    }

    injectEnhancedStyles() {
        if (this.customStyles) return;
        
        this.customStyles = document.createElement('style');
        this.customStyles.id = 'smart-dark-mode-enhanced';
        this.customStyles.textContent = `
            /* Enhanced intelligent dark mode */
            html.smart-dark-mode-active {
                filter: invert(0.9) hue-rotate(180deg) !important;
            }
            
            html.smart-dark-mode-active img,
            html.smart-dark-mode-active picture,
            html.smart-dark-mode-active video,
            html.smart-dark-mode-active iframe,
            html.smart-dark-mode-active [style*="background-image"],
            html.smart-dark-mode-active canvas {
                filter: invert(1) hue-rotate(-180deg) !important;
            }
            
            /* Preserve logos and icons */
            html.smart-dark-mode-active svg,
            html.smart-dark-mode-active .icon,
            html.smart-dark-mode-active [class*="logo"],
            html.smart-dark-mode-active [id*="logo"] {
                filter: invert(1) hue-rotate(-180deg) !important;
            }
            
            /* Smooth transitions */
            html.smart-dark-mode-active * {
                transition: background-color 0.3s ease, color 0.3s ease !important;
            }
        `;
        
        document.head.appendChild(this.customStyles);
    }

    applyCustomCSS(css) {
        // Remove existing custom CSS
        if (this.customCSSStyle) {
            this.customCSSStyle.remove();
        }
        
        // Apply new custom CSS
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
            } catch (e) {
                console.warn('Invalid selector:', selector);
            }
        });
    }

    applyAILayoutFixes() {
        // AI-powered layout fixes
        const fixes = document.createElement('style');
        fixes.id = 'smart-dark-ai-fixes';
        fixes.textContent = `
            /* AI Layout Fixes */
            html.smart-dark-mode-active {
                /* Improve text contrast */
                --text-color: #e0e0e0;
                --bg-color: #1a1a1a;
            }
            
            /* Fix low contrast text */
            html.smart-dark-mode-active body,
            html.smart-dark-mode-active p,
            html.smart-dark-mode-active span,
            html.smart-dark-mode-active div {
                color: var(--text-color) !important;
            }
            
            /* Fix bright backgrounds */
            html.smart-dark-mode-active [style*="background: white"],
            html.smart-dark-mode-active [style*="background: #fff"],
            html.smart-dark-mode-active [style*="background-color: white"],
            html.smart-dark-mode-active [style*="background-color: #fff"] {
                background-color: var(--bg-color) !important;
            }
            
            /* Improve input fields */
            html.smart-dark-mode-active input,
            html.smart-dark-mode-active textarea,
            html.smart-dark-mode-active select {
                background-color: #2a2a2a !important;
                color: #e0e0e0 !important;
                border-color: #444 !important;
            }
            
            /* Fix buttons */
            html.smart-dark-mode-active button {
                background-color: #3a3a3a !important;
                color: #e0e0e0 !important;
                border-color: #555 !important;
            }
        `;
        document.head.appendChild(fixes);
    }

    removeAILayoutFixes() {
        const fixes = document.getElementById('smart-dark-ai-fixes');
        if (fixes) {
            fixes.remove();
        }
    }

    // ===== ELEMENT SELECTOR FUNCTIONALITY =====
    startElementSelector() {
        if (this.elementSelectorActive) return;
        
        this.elementSelectorActive = true;
        this.currentHighlighted = null;
        
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'smart-dark-selector-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(108, 99, 255, 0.05);
            z-index: 999998;
            pointer-events: none;
        `;
        document.body.appendChild(this.overlay);
        
        // Create instruction box
        this.instructionBox = document.createElement('div');
        this.instructionBox.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(108, 99, 255, 0.95);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 1000000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            pointer-events: none;
        `;
        this.instructionBox.textContent = '🎯 Click any element to hide it • Press ESC to cancel';
        document.body.appendChild(this.instructionBox);
        
        // Bind event handlers
        this.handleMouseOver = this.handleMouseOver.bind(this);
        this.handleMouseOut = this.handleMouseOut.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        // Add event listeners
        document.addEventListener('mouseover', this.handleMouseOver, true);
        document.addEventListener('mouseout', this.handleMouseOut, true);
        document.addEventListener('click', this.handleClick, true);
        document.addEventListener('keydown', this.handleKeyDown, true);
    }

    stopElementSelector() {
        if (!this.elementSelectorActive) return;
        
        this.elementSelectorActive = false;
        
        // Remove overlay and instruction box
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.instructionBox && this.instructionBox.parentNode) {
            this.instructionBox.parentNode.removeChild(this.instructionBox);
        }
        
        // Remove event listeners
        document.removeEventListener('mouseover', this.handleMouseOver, true);
        document.removeEventListener('mouseout', this.handleMouseOut, true);
        document.removeEventListener('click', this.handleClick, true);
        document.removeEventListener('keydown', this.handleKeyDown, true);
        
        // Clear highlighted element
        if (this.currentHighlighted) {
            this.unhighlightElement(this.currentHighlighted);
            this.currentHighlighted = null;
        }
    }

    handleMouseOver(e) {
        if (!this.elementSelectorActive) return;
        
        // Don't highlight overlay or instruction box
        if (e.target === this.overlay || e.target === this.instructionBox) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Unhighlight previous element
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
        
        // Don't handle clicks on overlay or instruction box
        if (e.target === this.overlay || e.target === this.instructionBox) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const element = e.target;
        const selector = this.getSelector(element);
        
        // Hide the element
        element.style.display = 'none';
        element.setAttribute('data-smart-dark-hidden', 'true');
        
        // Save to preferences
        this.saveRemovedElement(selector);
        
        // Show confirmation
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
        // Try ID first
        if (element.id) {
            return '#' + element.id;
        }
        
        // Try class
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.trim() && !c.includes('smart-dark'));
            if (classes.length > 0) {
                return element.tagName.toLowerCase() + '.' + classes[0];
            }
        }
        
        // Fallback to tag name with nth-child
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
        const sitePrefs = prefs[this.hostname] || { removedElements: [] };
        
        if (!sitePrefs.removedElements) {
            sitePrefs.removedElements = [];
        }
        
        if (!sitePrefs.removedElements.includes(selector)) {
            sitePrefs.removedElements.push(selector);
            prefs[this.hostname] = sitePrefs;
            await chrome.storage.local.set({ sitePreferences: prefs });
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(78, 205, 196, 0.95);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000001;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 300);
        }, 3000);
    }

    observePageChanges() {
        if (document.body) {
            this.observer = new MutationObserver((mutations) => {
                // Observer is active, CSS will handle new elements
            });
            
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
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
                if (request.enabled) {
                    this.applyAILayoutFixes();
                } else {
                    this.removeAILayoutFixes();
                }
                sendResponse({ success: true });
                break;
                
            case 'applyCustomCSS':
                this.applyCustomCSS(request.css);
                sendResponse({ success: true });
                break;
                
            case 'getStatus':
                sendResponse({ 
                    enabled: this.darkModeEnabled,
                    hostname: this.hostname 
                });
                break;
                
            default:
                sendResponse({ error: 'Unknown action' });
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SmartDarkMode();
    });
} else {
    new SmartDarkMode();
}