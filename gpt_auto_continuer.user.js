// ==UserScript==
// @name         ChatGPT Auto Continuer
// @namespace    http://tampermonkey.net/
// @version      2025-03-13
// @description  Automatically continue ChatGPT responses with a toggleable switch
// @author       You
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Configuration
    const config = {
        checkInterval: 500,  // Check for new responses every 0.5 seconds (more responsive)
        debounceTime: 800,   // Wait time after generation stops (reduced for faster response)
        stabilityChecks: 2,  // Number of checks before considering content stable (reduced)
        stabilityThreshold: 2000, // Time in ms to wait before considering content stable (reduced)
        stuckTimeout: 5000,  // Time to wait before considering the UI stuck
        debugMode: true,     // Set to true to enable console logging
        maxContinues: 7      // Maximum number of continue attempts per session
    };

    // Keywords that suggest response is complete and we should NOT continue
    const completionKeywords = [
        "that covers everything",
        "That covers everything",
        "no additional",
        "No additional",
        "We are at an impasse",
        "we are at an impasse",
        "There is no more",
        "there is no more",
        "There is no further",
        "there is no further",
        "no further",
        "We’ve provided the complete",
        "we’ve provided the complete",
        "We have reached",
        "we have reached",
        "There is no remaining",
        "there is no remaining",
        "no remaining",
        "That concludes",
        "have addressed all",
        "have covered all",
        "is there anything else you'd like to know",
        "is there anything else you would like to know",
        "if you have any more questions",
        "if you have any other questions",
        "hope this helps",
        "let me know if you need",
        "feel free to ask",
        // Chinese completion keywords
        "全文完",
        "已完成全部",
        "如果还有其他需求",
        "已无更多",
        "以上即为全",
        "没有更多",
        "完全结束",
        "全部结束",
        "全部内容",
        "没有更多后续对话内容",
        "所有内容",
        "已全部",
        "已全部完成",
        "以上即为原文的完整"
    ];

    // Helper function for logging
    function log(message) {
        if (config.debugMode) {
            console.log(`[ChatGPT Auto Continue] ${message}`);
        }
    }

    // Main function to create and add the toggle switch
    function createToggleSwitch() {
        // Check if the switch already exists and remove it
        const existingSwitch = document.getElementById('auto-continue-switch-container');
        if (existingSwitch) {
            existingSwitch.remove();
        }

        // Forcefully clear any existing preference to ensure OFF by default
        localStorage.removeItem('chatgpt-auto-continue');
        localStorage.setItem('chatgpt-auto-continue', 'false');
        
        // Initialize counter if it doesn't exist yet
        if (!localStorage.getItem('chatgpt-auto-continue-count')) {
            localStorage.setItem('chatgpt-auto-continue-count', '0');
            log("Initialized continue counter to 0");
        }

        // Create container
        const container = document.createElement('div');
        container.id = 'auto-continue-switch-container';
        container.style.position = 'fixed';
        container.style.bottom = '100px';
        container.style.right = '20px';
        container.style.backgroundColor = 'rgba(100, 100, 100, 0.9)'; // Start with gray for inactive
        container.style.color = 'white';
        container.style.padding = '8px 12px';
        container.style.borderRadius = '8px';
        container.style.zIndex = '10000';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.gap = '5px';
        container.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        container.style.fontSize = '14px';
        container.style.transition = 'opacity 0.3s ease, background-color 0.3s ease';
        container.style.opacity = '0.9';

        // Add hover effect to reduce opacity when not hovered
        container.addEventListener('mouseenter', () => {
            container.style.opacity = '1';
        });
        container.addEventListener('mouseleave', () => {
            container.style.opacity = '0.9';
        });

        // Create label
        const label = document.createElement('div');
        label.textContent = 'Auto Continue';
        label.style.fontWeight = 'bold';

        // Create max continuations input container
        const maxContinuesContainer = document.createElement('div');
        maxContinuesContainer.style.display = 'flex';
        maxContinuesContainer.style.alignItems = 'center';
        maxContinuesContainer.style.marginBottom = '5px';
        maxContinuesContainer.style.width = '100%';
        maxContinuesContainer.style.justifyContent = 'space-between';

        const maxContinuesLabel = document.createElement('span');
        maxContinuesLabel.textContent = 'Max Continues:';
        maxContinuesLabel.style.fontSize = '12px';

        const maxContinuesInput = document.createElement('input');
        maxContinuesInput.type = 'number';
        maxContinuesInput.id = 'auto-continue-max';
        maxContinuesInput.min = '1';
        maxContinuesInput.max = '100';
        maxContinuesInput.step = '1';
        maxContinuesInput.value = localStorage.getItem('chatgpt-auto-continue-max') || config.maxContinues;
        maxContinuesInput.style.width = '45px';
        maxContinuesInput.style.padding = '2px 5px';
        maxContinuesInput.style.border = '1px solid #ccc';
        maxContinuesInput.style.borderRadius = '4px';
        maxContinuesInput.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        maxContinuesInput.style.color = '#333';
        maxContinuesInput.style.fontSize = '12px';

        // Save max continuations when changed
        maxContinuesInput.addEventListener('change', function() {
            const value = parseInt(this.value, 10);
            if (value < 1) this.value = 1;
            if (value > 100) this.value = 100;
            localStorage.setItem('chatgpt-auto-continue-max', this.value);
            log(`Max continues set to ${this.value}`);
            
            // Update the display with the new max value
            const maxContinues = parseInt(this.value, 10);
            const currentCount = parseInt(localStorage.getItem('chatgpt-auto-continue-count') || '0', 10);
            document.getElementById('auto-continue-counter').textContent = `Continues: ${currentCount}/${maxContinues}`;
        });

        maxContinuesContainer.appendChild(maxContinuesLabel);
        maxContinuesContainer.appendChild(maxContinuesInput);

        // Create switch
        const switchContainer = document.createElement('label');
        switchContainer.style.position = 'relative';
        switchContainer.style.display = 'inline-block';
        switchContainer.style.width = '46px';
        switchContainer.style.height = '24px';
        switchContainer.style.cursor = 'pointer';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'auto-continue-toggle';
        checkbox.style.opacity = '0';
        checkbox.style.width = '0';
        checkbox.style.height = '0';

        // Explicitly set to unchecked (OFF) by default
        checkbox.checked = false;

        const slider = document.createElement('span');
        slider.style.position = 'absolute';
        slider.style.cursor = 'pointer';
        slider.style.top = '0';
        slider.style.left = '0';
        slider.style.right = '0';
        slider.style.bottom = '0';
        slider.style.backgroundColor = '#ccc';
        slider.style.transition = '.4s';
        slider.style.borderRadius = '24px';

        const sliderBefore = document.createElement('span');
        sliderBefore.style.position = 'absolute';
        sliderBefore.style.content = '""';
        sliderBefore.style.height = '18px';
        sliderBefore.style.width = '18px';
        sliderBefore.style.left = '3px';
        sliderBefore.style.bottom = '3px';
        sliderBefore.style.backgroundColor = 'white';
        sliderBefore.style.transition = '.4s';
        sliderBefore.style.borderRadius = '50%';

        // Create status text
        const statusText = document.createElement('div');
        statusText.id = 'auto-continue-status';
        statusText.textContent = 'Inactive'; // Default to Inactive
        statusText.style.fontSize = '12px';
        statusText.style.marginTop = '2px';

        // Create continues counter text
        const continuesCounter = document.createElement('div');
        continuesCounter.id = 'auto-continue-counter';
        const maxContinues = parseInt(localStorage.getItem('chatgpt-auto-continue-max') || config.maxContinues, 10);
        const currentCount = parseInt(localStorage.getItem('chatgpt-auto-continue-count') || '0', 10);
        continuesCounter.textContent = `Continues: ${currentCount}/${maxContinues}`;
        continuesCounter.style.fontSize = '11px';
        continuesCounter.style.marginTop = '2px';
        continuesCounter.style.opacity = '0.8';

        // Assemble the toggle switch
        slider.appendChild(sliderBefore);
        switchContainer.appendChild(checkbox);
        switchContainer.appendChild(slider);

        // Add elements to container
        container.appendChild(label);
        container.appendChild(maxContinuesContainer);
        container.appendChild(switchContainer);
        container.appendChild(statusText);
        container.appendChild(continuesCounter);

        // Add container to body
        document.body.appendChild(container);

        // Update style when checked
        function updateSliderStyle() {
            if (checkbox.checked) {
                slider.style.backgroundColor = '#19c37d'; // Green slider
                sliderBefore.style.transform = 'translateX(22px)';
                statusText.textContent = 'Active';
                container.style.backgroundColor = 'rgba(25, 195, 125, 0.9)'; // Green container
                maxContinuesInput.disabled = true; // Disable max continues input when active
            } else {
                slider.style.backgroundColor = '#ccc'; // Gray slider
                sliderBefore.style.transform = 'translateX(0)';
                statusText.textContent = 'Inactive';
                container.style.backgroundColor = 'rgba(100, 100, 100, 0.9)'; // Gray container
                maxContinuesInput.disabled = false; // Enable max continues input when inactive
            }
        }

        // Save preference when changed
        checkbox.addEventListener('change', function () {
            localStorage.setItem('chatgpt-auto-continue', this.checked);
            updateSliderStyle();
            log(`Auto Continue ${this.checked ? 'enabled' : 'disabled'}`);

            // Reset continues counter when toggling on
            if (this.checked) {
                // Reset the counter in the UI
                const maxContinues = parseInt(localStorage.getItem('chatgpt-auto-continue-max') || config.maxContinues, 10);
                document.getElementById('auto-continue-counter').textContent = `Continues: 0/${maxContinues}`;
                
                // Also reset the counter in localStorage
                localStorage.setItem('chatgpt-auto-continue-count', '0');
                
                // Restart monitoring
                startMonitoring();
                log("Restarted monitoring");
            }
        });

        // Initialize slider style (should show as OFF)
        updateSliderStyle();

        // Add keyboard shortcut (Alt+C) to toggle
        document.addEventListener('keydown', function (e) {
            if (e.altKey && e.key === 'c') {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        log("Toggle switch created - default OFF");
    }

    // Update the status text
    function updateStatus(message) {
        log(`Status update: ${message}`);
        const statusElement = document.getElementById('auto-continue-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    // Function to check if textarea/input is disabled
    function isInputDisabled() {
        try {
            // Try multiple ways to find the input field
            const textareas = document.querySelectorAll('textarea');
            const promptTextareas = document.querySelectorAll('#prompt-textarea');
            const contentEditables = document.querySelectorAll('[contenteditable="true"]');

            // Track if we found any input field at all
            let foundAnyInputField = false;

            // Check textareas
            for (const textarea of textareas) {
                if (textarea.offsetParent !== null) {
                    foundAnyInputField = true;
                    // Check if parent form is hidden
                    const parentForm = textarea.closest('form');
                    if (parentForm && window.getComputedStyle(parentForm).display === 'none') {
                        continue; // Skip this one, try to find a visible one
                    }

                    if (textarea.disabled || textarea.getAttribute('disabled') === 'true' ||
                        textarea.getAttribute('aria-disabled') === 'true') {
                        return true;
                    }

                    // Extra check: sometimes the disabled attribute is on a parent div
                    const parentDiv = textarea.closest('div[disabled]');
                    if (parentDiv) {
                        return true;
                    }
                }
            }

            // Check prompt-textarea (ChatGPT specific)
            for (const prompt of promptTextareas) {
                if (prompt.offsetParent !== null) {
                    foundAnyInputField = true;
                    if (prompt.disabled || prompt.getAttribute('disabled') === 'true' ||
                        prompt.getAttribute('aria-disabled') === 'true') {
                        return true;
                    }

                    // ChatGPT sometimes uses a parent container to disable the textarea
                    const parent = prompt.parentElement;
                    if (parent && (parent.getAttribute('disabled') === 'true' ||
                        parent.classList.contains('disabled'))) {
                        return true;
                    }
                }
            }

            // Check contentEditables
            for (const editable of contentEditables) {
                if (editable.offsetParent !== null) {
                    foundAnyInputField = true;
                    if (editable.getAttribute('contenteditable') !== 'true' ||
                        editable.getAttribute('aria-disabled') === 'true') {
                        return true;
                    }
                }
            }

            // If we found any input field and none were disabled, input is enabled
            if (foundAnyInputField) {
                return false;
            }

            // If we didn't find any input fields, check if send button is disabled
            // as a fallback method
            const sendButtons = document.querySelectorAll(
                'button[data-testid="send-button"], form button[type="submit"], button.absolute'
            );

            let foundAnyButton = false;

            for (const btn of sendButtons) {
                if (btn.offsetParent !== null) {
                    foundAnyButton = true;
                    if (!btn.disabled) {
                        // If button is enabled, input is probably enabled too
                        return false;
                    }
                }
            }

            // If we found buttons and all were disabled, input is probably disabled
            if (foundAnyButton) {
                return true;
            }

            // Default - if we can't determine state clearly, assume not disabled
            // to avoid getting stuck in waiting state
            return false;
        } catch (e) {
            log(`Error checking input disabled: ${e.message}`);
            return false; // Default to not disabled on error
        }
    }

    // Enhanced function to check if a response is being generated
    function checkIfGenerating() {
        try {
            // More comprehensive list of indicators
            const indicators = [
                // Loading indicators
                document.querySelector('.result-streaming'),
                document.querySelector('.loading'),
                document.querySelector('.animate-pulse'),
                document.querySelector('.animate-spin'),
                document.querySelector('[data-state="loading"]'),
                // Additional indicators
                document.querySelector('[role="progressbar"]'),
                document.querySelector('.text-token-text-streaming'),
                document.querySelector('.text-message.loading'),
                document.querySelector('span[style*="will-change"]'),
                // New indicators for latest UI
                document.querySelector('.text-token-streaming'),
                document.querySelector('.text-ellipsis'),
                document.querySelector('.text-cursor'),
                document.querySelector('.result-thinking')
            ];

            // Check for any visible loading indicators
            for (const indicator of indicators) {
                if (indicator && indicator.offsetParent !== null) {
                    log(`Generation detected via indicator: ${indicator.className || indicator.tagName}`);
                    return true;
                }
            }

            // Check for cursor blinking animation
            const blinkingElements = document.querySelectorAll('.blinking-cursor, .animate-blink');
            for (const el of blinkingElements) {
                if (el.offsetParent !== null) {
                    log('Generation detected via blinking cursor');
                    return true;
                }
            }

            // CRITICAL: Check for submit button state - but ONLY if input field is also disabled
            // This prevents false positives where buttons remain disabled after generation completes
            if (isInputDisabled()) {
                // Then check buttons
                const submitButtons = document.querySelectorAll('button[type="submit"]');
                for (const btn of submitButtons) {
                    if (btn.offsetParent !== null && btn.disabled) {
                        log('Generation detected via disabled submit button with disabled input');
                        return true;
                    }
                }

                // Also check form buttons
                const formButtons = document.querySelectorAll('form button');
                for (const btn of formButtons) {
                    if (btn.offsetParent !== null && btn.disabled) {
                        log('Generation detected via disabled form button with disabled input');
                        return true;
                    }
                }

                log('Generation detected via disabled input');
                return true;
            }

            // If we get here, check if there's actual text being rendered right now
            const lastMessage = findLastAssistantMessage();
            if (lastMessage) {
                // Look for specific streaming indicators inside the message
                const streamingIndicators = lastMessage.querySelectorAll(
                    '.result-streaming, .text-token-streaming, .blinking-cursor, .animate-blink'
                );

                if (streamingIndicators.length > 0) {
                    for (const indicator of streamingIndicators) {
                        if (indicator.offsetParent !== null) {
                            log('Generation detected via streaming indicator inside message');
                            return true;
                        }
                    }
                }
            }

            return false;
        } catch (e) {
            log(`Error in checkIfGenerating: ${e.message}`);
            return false;
        }
    }

    // Function to check if ChatGPT is ready to receive new input
    function isChatGPTReady() {
        try {
            // MOST IMPORTANT CHECK: Is the input field enabled? If yes, system is likely ready
            if (!isInputDisabled()) {
                // Do a secondary check for any visible spinners or progress indicators
                const spinners = document.querySelectorAll('.animate-spin, [role="progressbar"]');
                let visibleSpinner = false;
                for (const spinner of spinners) {
                    if (spinner.offsetParent !== null) {
                        visibleSpinner = true;
                        break;
                    }
                }

                if (!visibleSpinner) {
                    // No spinners and input is enabled - likely ready
                    log("Input field is enabled and no spinners - ChatGPT ready");
                    return true;
                }
            }

            // Check if there are any error messages visible
            const errorElements = document.querySelectorAll('[data-error="true"], .error, .text-red-500');
            for (const el of errorElements) {
                if (el.offsetParent !== null && el.textContent.includes('error')) {
                    log("Error message visible, ChatGPT not ready");
                    return false;
                }
            }

            // Check if any request is in progress (look for network activity indicators)
            if (checkIfGenerating()) {
                log("Still generating, ChatGPT not ready");
                return false;
            }

            // Check if the input field is disabled
            if (isInputDisabled()) {
                log("Input is disabled, ChatGPT not ready");
                return false;
            }

            // Additional check: can we find a visible, non-disabled send button?
            const sendButtonSelectors = [
                'button[data-testid="send-button"]',
                'button.absolute.p-1',
                'button[type="submit"]',
                'form button:last-of-type'
            ];

            let foundEnabledButton = false;
            for (const selector of sendButtonSelectors) {
                const buttons = document.querySelectorAll(selector);
                for (const btn of buttons) {
                    if (btn.offsetParent !== null && !btn.disabled) {
                        foundEnabledButton = true;
                        break;
                    }
                }
                if (foundEnabledButton) break;
            }

            if (!foundEnabledButton) {
                // No enabled send button found
                log("No enabled send button found, ChatGPT might not be ready");
                // But don't return false here - the input state is more reliable
            }

            return true;
        } catch (e) {
            log(`Error in isChatGPTReady: ${e.message}`);
            return false; // If in doubt, assume not ready
        }
    }

    // Improved function to find the last message from the assistant
    function findLastAssistantMessage() {
        try {
            // Try multiple selector approaches in order of specificity

            // Store all potential message containers
            const potentialMessages = [];

            // 1. By data attribute (most specific)
            const byRole = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
            if (byRole && byRole.length > 0) {
                // Get the most recent visible one
                const visibleMessages = byRole.filter(el => el.offsetParent !== null);
                if (visibleMessages.length > 0) {
                    log(`Found ${visibleMessages.length} visible messages by role`);
                    potentialMessages.push(visibleMessages[visibleMessages.length - 1]);
                }
            }

            // 2. By markdown prose class
            const markdown = Array.from(document.querySelectorAll('.markdown.prose'));
            if (markdown && markdown.length > 0) {
                const visibleMarkdown = markdown.filter(el => el.offsetParent !== null);
                if (visibleMarkdown.length > 0) {
                    log(`Found ${visibleMarkdown.length} visible markdown elements`);
                    potentialMessages.push(visibleMarkdown[visibleMarkdown.length - 1]);
                }
            }

            // 3. By message class patterns (common in new UI)
            const messagePatterns = [
                '.text-base.my-auto.mx-auto',
                '.text-message',
                '.message-content',
                '.break-words',
                '.assistant-message',
                '.chat-message[data-message-id]',
                '.prose'
            ];

            for (const pattern of messagePatterns) {
                const elements = Array.from(document.querySelectorAll(pattern));
                const visibleElements = elements.filter(el => el.offsetParent !== null);
                if (visibleElements.length > 0) {
                    log(`Found ${visibleElements.length} visible elements with pattern ${pattern}`);
                    potentialMessages.push(visibleElements[visibleElements.length - 1]);
                }
            }

            // 4. By article elements
            const articles = Array.from(document.querySelectorAll('article'));
            if (articles && articles.length > 0) {
                const visibleArticles = articles.filter(el => el.offsetParent !== null);
                if (visibleArticles.length > 0) {
                    log(`Found ${visibleArticles.length} visible articles`);
                    // Look for the articles in the main content area
                    const mainArticles = visibleArticles.filter(el => {
                        const rect = el.getBoundingClientRect();
                        // Typically in the middle of the screen
                        return rect.left > 100 && rect.right < window.innerWidth - 100;
                    });

                    if (mainArticles.length > 0) {
                        potentialMessages.push(mainArticles[mainArticles.length - 1]);
                    } else {
                        potentialMessages.push(visibleArticles[visibleArticles.length - 1]);
                    }
                }
            }

            // 5. Fallback: any substantial text content
            const allDivs = Array.from(document.querySelectorAll('div'));
            const contentDivs = allDivs.filter(div => {
                const text = div.textContent || '';
                // Must be visible and have substantial text
                return text.length > 100 && div.offsetParent !== null;
            });

            if (contentDivs.length > 0) {
                log(`Found ${contentDivs.length} content-rich divs`);
                // Sort by most likely to be the latest message (bottom of page)
                contentDivs.sort((a, b) => {
                    const rectA = a.getBoundingClientRect();
                    const rectB = b.getBoundingClientRect();
                    return rectB.bottom - rectA.bottom;
                });
                potentialMessages.push(contentDivs[0]);
            }

            // Find the most likely candidate by checking content and position
            if (potentialMessages.length > 0) {
                // First check: recent message should be near the bottom
                potentialMessages.sort((a, b) => {
                    const rectA = a.getBoundingClientRect();
                    const rectB = b.getBoundingClientRect();

                    // Prioritize elements closer to the bottom
                    return rectB.bottom - rectA.bottom;
                });

                // Second check: content should be substantial
                const substantial = potentialMessages.filter(el =>
                    (el.textContent || '').length > 50
                );

                if (substantial.length > 0) {
                    log("Found substantial message content");
                    return substantial[0];
                }

                log("Using best position-based candidate");
                return potentialMessages[0];
            }

            log("No message found by any method");
            return null;
        } catch (e) {
            log(`Error finding message: ${e.message}`);
            return null;
        }
    }

    // Enhanced function to check if we should continue based on message content
    function shouldContinueMessage(messageText) {
        if (!messageText || messageText.length < 50) {
            log("Message too short to continue");
            return false;
        }

        // Check for completion indicators
        for (const keyword of completionKeywords) {
            if (messageText.toLowerCase().includes(keyword.toLowerCase())) {
                log(`Found completion keyword: "${keyword}"`);
                return false;
            }
        }

        // Additional checks: Look for incomplete sentences at the end
        const lastChar = messageText.trim().slice(-1);
        const endsWithPunctuation = ['.', '!', '?', ':', ';'].includes(lastChar);

        // Check for signs of truncation
        const hasTruncationSigns = messageText.endsWith('...') ||
            messageText.endsWith('…') ||
            messageText.toLowerCase().endsWith('continued') ||
            messageText.toLowerCase().endsWith('to be continued');

        if (hasTruncationSigns) {
            log("Message appears truncated, should continue");
            return true;
        }

        // If it ends with punctuation and doesn't have signs of truncation
        if (endsWithPunctuation) {
            // Additional check: if the message ends with a complete paragraph, it might be complete
            const paragraphs = messageText.split('\n\n');
            const lastParagraph = paragraphs[paragraphs.length - 1].trim();

            // If the last paragraph is very short, it might be a conclusion
            if (lastParagraph.length < 50 && endsWithPunctuation) {
                log("Message ends with a short, complete paragraph - might be complete");
                return false;
            }

            // Check if message ends with code block
            if (messageText.endsWith('```') || messageText.includes('```\n\n')) {
                log("Message ends with completed code block");
                return false;
            }
        } else {
            // If it doesn't end with punctuation, it's likely incomplete
            log("Message doesn't end with punctuation, likely incomplete");
            return true;
        }

        // Check for partial lists or bullet points
        const lines = messageText.split('\n');
        const lastFewLines = lines.slice(-3);

        // Look for patterns like numbered lists or bullet points
        const listPatterns = lastFewLines.filter(line =>
            /^\s*\d+\./.test(line) || // Numbered list
            /^\s*[\-\*\•]/.test(line)  // Bullet points
        );

        if (listPatterns.length > 0) {
            log("Message appears to end with a list item, likely incomplete");
            return true;
        }

        // Look for patterns suggesting a new section was about to start
        const sectionHeaders = lastFewLines.filter(line =>
            /^#+\s/.test(line) || // Markdown headers
            /^[A-Z][^.!?]*:$/.test(line) // Title with colon
        );

        if (sectionHeaders.length > 0 && sectionHeaders[0] === lastFewLines[lastFewLines.length - 1]) {
            log("Message ends with a section header, likely incomplete");
            return true;
        }

        // Default to continuing if in doubt
        log("No clear completion signals, defaulting to continue");
        return true;
    }

    // Improved continue command function - more direct approach
    function sendContinueCommandSimple() {
        log("Sending continue command");
        updateStatus("Sending continue...");

        try {
            // Check if o1-pro is processing - if so, don't even try to send
            if (isO1ProProcessing()) {
                log("Cannot send continue - o1-pro is still processing");
                updateStatus("O1 processing, wait");
                return false;
            }
            
            // First, increment the counter BEFORE sending the continue
            // This ensures the counter is updated regardless of async timing issues
            const currentCount = parseInt(localStorage.getItem('chatgpt-auto-continue-count') || '0', 10);
            const maxContinues = parseInt(localStorage.getItem('chatgpt-auto-continue-max') || config.maxContinues, 10);
            
            // Increment the counter and save to localStorage IMMEDIATELY
            const newCount = currentCount + 1;
            localStorage.setItem('chatgpt-auto-continue-count', newCount.toString());
            
            // Update the UI
            const continueCounter = document.getElementById('auto-continue-counter');
            if (continueCounter) {
                continueCounter.textContent = `Continues: ${newCount}/${maxContinues}`;
                log(`Updated continue counter: ${newCount}/${maxContinues}`);
            }
            
            // Find the input field by trying multiple approaches
            const inputFieldOptions = [
                document.querySelector('#prompt-textarea'),
                document.querySelector('[role="textbox"]'),
                document.querySelector('.ProseMirror'),
                document.querySelector('[contenteditable="true"]'),
                document.querySelector('form textarea'),
                document.querySelector('textarea')
            ];

            // Filter for visible, enabled input fields
            let inputField = null;
            for (const field of inputFieldOptions) {
                if (field && field.offsetParent !== null &&
                    !field.disabled && field.getAttribute('disabled') !== 'true') {
                    inputField = field;
                    break;
                }
            }

            if (!inputField) {
                log("No input field found");
                updateStatus("No input field found");
                return false;
            }

            log(`Found input field: ${inputField.tagName || 'contenteditable'}`);

            // Clear and set text using the appropriate method
            if (inputField.tagName === 'TEXTAREA') {
                // Standard textarea
                inputField.value = 'continue';

                // Ensure the value is set correctly
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, "value"
                ).set;
                nativeInputValueSetter.call(inputField, 'continue');
            } else {
                // Contenteditable field
                inputField.innerHTML = 'continue';

                // Ensure text is set
                if (inputField.textContent !== 'continue') {
                    inputField.textContent = 'continue';
                }
            }

            // Force UI update events
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
            inputField.dispatchEvent(new Event('change', { bubbles: true }));

            // Give focus to the field
            inputField.focus();

            // Variable to track if we successfully sent the continue
            let continueSent = false;

            // SHORT DELAY then find and click the send button
            setTimeout(() => {
                // Find the send button - start with specific selectors
                const buttonSelectors = [
                    'button[data-testid="send-button"]',
                    'button.absolute.p-1',
                    'button[type="submit"]',
                    'form button:last-of-type',
                    'button.chat-send-button',
                    'button[aria-label="Send message"]',
                    'button svg[data-testid="send-button"]'
                ];

                let sendButton = null;

                // Try each selector
                for (const selector of buttonSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        // Check for svg inside button
                        const button = selector.includes('svg') ? el.closest('button') : el;
                        if (button && button.offsetParent !== null && !button.disabled) {
                            sendButton = button;
                            break;
                        }
                    }
                    if (sendButton) break;
                }

                // If no button found with selectors, look for any button near the input
                if (!sendButton) {
                    log("Using proximity search for send button");

                    // Get input field position
                    const inputRect = inputField.getBoundingClientRect();

                    // Find all visible buttons
                    const allButtons = Array.from(document.querySelectorAll('button'))
                        .filter(btn => btn.offsetParent !== null && !btn.disabled);

                    // Sort by proximity to input field
                    allButtons.sort((a, b) => {
                        const rectA = a.getBoundingClientRect();
                        const rectB = b.getBoundingClientRect();

                        // Calculate distances
                        const distA = Math.sqrt(
                            Math.pow(rectA.left - inputRect.right, 2) +
                            Math.pow(rectA.top - inputRect.top, 2)
                        );
                        const distB = Math.sqrt(
                            Math.pow(rectB.left - inputRect.right, 2) +
                            Math.pow(rectB.top - inputRect.top, 2)
                        );

                        return distA - distB;
                    });

                    // Take the closest button
                    if (allButtons.length > 0) {
                        sendButton = allButtons[0];
                    }
                }

                if (!sendButton) {
                    log("No send button found");
                    updateStatus("No send button found");
                    continueSent = false;
                    return;
                }

                log(`Found send button: ${sendButton.textContent || 'icon button'}`);

                // Click the button
                sendButton.click();
                log("Clicked send button");
                continueSent = true;
                
                // Set a flag to indicate we just sent a continue and need to wait
                window._waitingAfterContinue = true;
                updateStatus("Waiting for response...");
                
                // After 5 seconds, clear the waiting flag
                setTimeout(() => {
                    window._waitingAfterContinue = false;
                    log("5-second minimum wait completed");
                }, 5000);
                
            }, 100); // Short delay before clicking send

            return true; // Indicate we initiated the continue process

        } catch (e) {
            log(`Error sending continue: ${e.message}`);
            updateStatus("Error sending continue");
            return false;
        }
    }

    // Main monitoring function - simplified and more robust
    function startMonitoring() {
        log("Starting simplified monitor for responses");

        // Clear any existing intervals to avoid duplicates
        if (window._autoContinueInterval) {
            clearInterval(window._autoContinueInterval);
        }

        // Simple state tracking variables
        let lastMessageContent = '';
        let lastMessageTime = Date.now();
        let stableCount = 0;
        let lastContinueTime = 0;
        let continueAttempts = 0;

        // Create a new monitoring interval with simpler, more reliable logic
        window._autoContinueInterval = setInterval(() => {
            try {
                // Only proceed if toggle is on
                const toggle = document.getElementById('auto-continue-toggle');
                if (!toggle || !toggle.checked) {
                    return;
                }

                // Show realistic status
                updateStatus("Monitoring...");

                // Get current time for calculations
                const currentTime = Date.now();

                // Check if we're in the waiting period after sending a continue
                if (window._waitingAfterContinue) {
                    updateStatus("Waiting for response...");
                    return;
                }

                // Rate limit continue attempts (max 1 every 10 seconds)
                if (currentTime - lastContinueTime < 10000 && continueAttempts > 0) {
                    updateStatus(`Cooling down (${Math.round((10000 - (currentTime - lastContinueTime)) / 1000)}s)`);
                    return;
                }

                // Check if o1-pro is processing - if so, don't even try to continue
                if (isO1ProProcessing()) {
                    updateStatus("O1 processing, wait");
                    return;
                }

                // SIMPLIFIED APPROACH:
                // 1. Find the last message
                // 2. Check if content is stable
                // 3. Check if input is enabled
                // 4. If conditions are met, continue

                // Step 1: Find the last message
                const lastMessage = findLastAssistantMessage();
                if (!lastMessage) {
                    updateStatus("No message found");
                    return;
                }

                // Step 2: Get current content and check stability
                const currentContent = lastMessage.textContent || '';

                // Skip if content is too short
                if (currentContent.length < 50) {
                    updateStatus("Message too short");
                    return;
                }

                // Check if content has changed
                if (currentContent !== lastMessageContent) {
                    log("Content changed, resetting stability counter");
                    lastMessageContent = currentContent;
                    lastMessageTime = currentTime;
                    stableCount = 0;
                    return;
                }

                // Content is unchanged, increment stability counter
                stableCount++;

                // Update status to show we're checking stability
                updateStatus(`Content stable (${stableCount}/3)`);

                // Step 3: Check if content is stable for enough time AND input is enabled
                const contentStable = stableCount >= 3;
                const inputEnabled = !isInputDisabled();

                // If input is enabled and content has been stable, we can consider continuing
                if (inputEnabled && contentStable) {
                    // Step 4: Check if we should continue this message
                    if (!shouldContinueMessage(currentContent)) {
                        updateStatus("Message complete");
                        return;
                    }

                    // Check if we've reached the maximum number of continuations
                    const maxContinues = parseInt(localStorage.getItem('chatgpt-auto-continue-max') || config.maxContinues, 10);
                    const currentCount = parseInt(localStorage.getItem('chatgpt-auto-continue-count') || '0', 10);
                    if (currentCount >= maxContinues) {
                        updateStatus(`Max continues (${maxContinues}) reached`);
                        return;
                    }

                    // We've met all criteria - send continue command
                    log("All conditions met for continuing message");
                    updateStatus("Continuing...");

                    // Send the continue command and only proceed if it was successful
                    const continueSuccess = sendContinueCommandSimple();
                    
                    // Only update tracking variables if we actually sent the message
                    if (continueSuccess) {
                        lastContinueTime = currentTime;
                        continueAttempts++;
                        stableCount = 0;
                        
                        // Note: Counter is now updated directly in sendContinueCommandSimple
                        // No need to update it here to avoid double-counting
                    } else {
                        log("Continue command failed to send");
                        // Don't reset stableCount so we can try again on next iteration
                    }
                    return;
                }

                // Alternative way to detect when to continue: if content has been stable
                // for a long time (10 seconds), try continuing regardless
                if (contentStable && (currentTime - lastMessageTime > 10000)) {
                    const maxContinues = parseInt(localStorage.getItem('chatgpt-auto-continue-max') || config.maxContinues, 10);
                    const currentCount = parseInt(localStorage.getItem('chatgpt-auto-continue-count') || '0', 10);
                    if (shouldContinueMessage(currentContent)) {
                        if (currentCount >= maxContinues) {
                            updateStatus(`Max continues (${maxContinues}) reached`);
                            return;
                        }
                        
                        log("Content stable for 10+ seconds, attempting continue");
                        updateStatus("Long stable, continuing...");
                        const continueSuccess = sendContinueCommandSimple();
                        
                        // Only update tracking variables if we actually sent the message
                        if (continueSuccess) {
                            lastContinueTime = currentTime;
                            continueAttempts++;
                            stableCount = 0;
                        } else {
                            log("Continue command failed to send");
                            // Don't reset stableCount so we can try again on next iteration
                        }
                    } else {
                        updateStatus("Message appears complete");
                    }
                }

            } catch (e) {
                // Only log the error, don't change the UI state to prevent flickering
                log(`Error in monitor: ${e.message}`);
            }
        }, 1000); // Check every second

        log("Simplified monitoring started");
        updateStatus("Monitoring...");
    }

    // Function to ensure the toggle is always visible
    function ensureToggleVisibility() {
        // Check periodically that the toggle exists
        setInterval(() => {
            if (!document.getElementById('auto-continue-switch-container')) {
                log("Toggle not found, recreating");
                createToggleSwitch();
            }
        }, 5000);
    }

    // Set up mutation observer to detect page changes
    function setupMutationObserver() {
        // Create a mutation observer to detect DOM changes
        const observer = new MutationObserver((mutations) => {
            const toggle = document.getElementById('auto-continue-toggle');
            if (toggle && toggle.checked) {
                // Only check for important changes that might indicate a new response
                const significantChanges = mutations.some(mutation => {
                    // Look for added nodes that might be messages
                    if (mutation.addedNodes && mutation.addedNodes.length) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Check if this might be a message container
                                if (node.tagName === 'DIV' || node.tagName === 'ARTICLE' ||
                                    node.tagName === 'SECTION') {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                });

                if (significantChanges) {
                    log("Significant DOM changes detected, checking state");
                    // Don't need to do anything - the interval will check
                }
            }
        });

        // Start observing with a configuration
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });

        log("Mutation observer set up");
    }

    // Function to check if o1-pro mode is processing
    function isO1ProProcessing() {
        try {
            log("Checking for o1-pro processing");
            
            // First, find the last assistant message to limit our search scope
            const lastMessage = findLastAssistantMessage();
            if (!lastMessage) {
                log("No last message found to check for o1-pro processing");
                return false;
            }
            
            // Helper function to search within the last message and its parent article
            const findInLastMessageArea = (selector) => {
                // First try direct children of the message
                let elements = Array.from(lastMessage.querySelectorAll(selector));
                
                // If not found, check the parent article which contains the full "turn"
                if (elements.length === 0) {
                    const parentArticle = lastMessage.closest('article');
                    if (parentArticle) {
                        elements = Array.from(parentArticle.querySelectorAll(selector));
                    }
                }
                
                // If still not found, try the entire document (for cases where the UI structure changes)
                if (elements.length === 0) {
                    elements = Array.from(document.querySelectorAll(selector));
                }
                
                // Filter to only visible elements
                return elements.filter(el => el.offsetParent !== null);
            };

            // Reset the O1 Pro status if no containers are found or if we have restarted
            if (!window._lastO1Check || Date.now() - window._lastO1Check > 60000) {
                window._o1ProProgressBarLastSeen = null;
                log("Resetting O1 Pro status due to long period without checks");
            }
            window._lastO1Check = Date.now();

            // Find all o1 pro mode containers
            const containers = findInLastMessageArea('.inline-flex.flex-col.items-start.justify-start.rounded-2xl');
            
            log(`Found ${containers.length} potential o1-pro containers`);
            
            // No containers means no O1 Pro processing
            if (containers.length === 0) {
                window._o1ProProgressBarLastSeen = null; // Reset waiting state
                return false;
            }
            
            // Check for active indicators - a progress bar OR a Details button
            let foundActiveProgressBar = false;
            let foundActiveDetailsButton = false;
            let foundO1ProContainer = false;
            
            for (const container of containers) {
                // First, check if this is an O1 Pro container by looking for the header text
                const headerText = container.querySelector('.text-token-text-primary')?.textContent?.trim() ||
                                  container.querySelector('.font-medium')?.textContent?.trim() ||
                                  container.querySelector('.text-token-text-secondary')?.textContent?.trim();
                
                if (headerText === 'Request for o1 pro mode') {
                    foundO1ProContainer = true;
                    log("Found o1-pro container with header text");
                    
                    // Look for the progress bar container with specific height
                    const progressBarContainer = container.querySelector('div[style*="height: 8px"]');
                    
                    // If we find a progress bar, it means processing is still ongoing
                    if (progressBarContainer) {
                        log("Found active o1-pro mode progress bar");
                        // Reset the timestamp when progress bar disappears
                        window._o1ProProgressBarLastSeen = Date.now();
                        foundActiveProgressBar = true;
                        
                        // Exit early - we found an active progress bar
                        return true;
                    }
                    
                    // If no progress bar but has Details button, still processing
                    const detailsButton = container.querySelector('button');
                    if (detailsButton && detailsButton.textContent?.trim() === 'Details') {
                        log("Found 'Details' button in o1-pro component");
                        foundActiveDetailsButton = true;
                        
                        // Exit early - we found an active Details button
                        return true;
                    }
                }
            }
            
            // If we found an O1 Pro container but no active indicators
            if (foundO1ProContainer && !foundActiveProgressBar && !foundActiveDetailsButton) {
                // Check if we were previously in a waiting period after a progress bar disappeared
                if (window._o1ProProgressBarLastSeen) {
                    // Check if it's been less than 10 seconds since the progress bar disappeared
                    const timeSinceProgressBarDisappeared = Date.now() - window._o1ProProgressBarLastSeen;
                    if (timeSinceProgressBarDisappeared < 10000) {
                        log(`Waiting for o1-pro content to finish (${Math.round((10000 - timeSinceProgressBarDisappeared) / 1000)}s remaining)`);
                        return true; // Still treat as processing during the waiting period
                    }
                    
                    // If it's been more than 10 seconds, reset the timestamp and allow continuing
                    log("10-second wait after o1-pro progress bar disappeared completed");
                    window._o1ProProgressBarLastSeen = null;
                }
            } else if (!foundO1ProContainer) {
                // If no O1 Pro containers found at all, reset any waiting state
                window._o1ProProgressBarLastSeen = null;
            }
            
            log("No active o1-pro processing indicators found");
            return false;
        } catch (e) {
            log(`Error checking o1-pro mode: ${e.message}`);
            return false; // Default to not in o1-pro mode on error
        }
    }

    // Initialize when the page is loaded
    function initialize() {
        log("Initializing Auto Continue script");

        // Forcefully clear any existing preference
        localStorage.removeItem('chatgpt-auto-continue');
        localStorage.setItem('chatgpt-auto-continue', 'false');

        createToggleSwitch();
        startMonitoring();
        ensureToggleVisibility();
        setupMutationObserver();
    }

    // Wait for the page to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Also initialize after navigation events
    window.addEventListener('popstate', initialize);
    window.addEventListener('pushstate', initialize);
    window.addEventListener('replacestate', initialize);

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // When page becomes visible again, make sure monitoring is working
            log("Page visibility changed to visible, refreshing monitoring");
            const toggle = document.getElementById('auto-continue-toggle');
            if (toggle && toggle.checked) {
                startMonitoring();
            }
        }
    });
})();