// Initialize Lucide Icons
// Elements
const topicInput = document.getElementById('topic');
const genreSelect = document.getElementById('genre');
const toneSelect = document.getElementById('tone');
const lengthSelect = document.getElementById('length');
const endingSelect = document.getElementById('ending');
const charactersInput = document.getElementById('characters');
const settingInput = document.getElementById('setting');
const generateBtn = document.getElementById('generateBtn');
const placeholderSection = document.getElementById('placeholderSection');
const essayOutput = document.getElementById('essayOutput');
const copyBtn = document.getElementById('copyBtn');
const themeToggle = document.getElementById('themeToggle');
const humanizeBtn = document.getElementById('humanizeBtn');

const API_ENDPOINT = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api/generate'
    : (window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io'))
    ? 'https://ai-essay-writer-blue.vercel.app/api/generate'
    : '/api/generate';

// Fetch helper with visual countdown. Timer resets to 30s if it reaches 0 — no backend abort or retry.
const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000, buttonElement = null, loadingText = "Loading") => {
    let secondsLeft = Math.round(timeoutMs / 1000);
    let timerId = null;

    if (buttonElement) {
        buttonElement.innerHTML = `
            <span>${loadingText} (${secondsLeft}s)</span>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        timerId = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) secondsLeft = Math.round(timeoutMs / 1000);
            buttonElement.innerHTML = `
                <span>${loadingText} (${secondsLeft}s)</span>
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
            `;
        }, 1000);
    }

    try {
        const response = await fetch(url, options);
        if (timerId) clearInterval(timerId);
        return response;
    } catch (err) {
        if (timerId) clearInterval(timerId);
        throw err;
    }
};

let isGenerating = false;

// Persist & guard topic against browser autofill clearing it
let topicGuard = '';
try {
    topicGuard = localStorage.getItem('storyTopic') || '';
} catch (e) { console.warn('localStorage access denied'); }

// Auto-resize textarea function
const autoResizeTextarea = (el) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
};

if (topicGuard) {
    topicInput.value = topicGuard;
    // Initial resize if content exists
    autoResizeTextarea(topicInput);
}

topicInput.addEventListener('input', () => {
    if (topicInput.value) topicGuard = topicInput.value;
    try { localStorage.setItem('storyTopic', topicInput.value); } catch(e) {}
    autoResizeTextarea(topicInput);
});

window.addEventListener('resize', () => autoResizeTextarea(topicInput));

// Restore topic immediately if any control change clears it
[genreSelect, toneSelect, lengthSelect, endingSelect, charactersInput, settingInput].forEach(el => {
    el.addEventListener('change', () => {
        if (!topicInput.value && topicGuard) {
            topicInput.value = topicGuard;
        }
    });
});

// Inline SVG definitions to bypass Brave/browser script blocking
const ICONS = {
    sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
    moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    sparkles: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/><path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z"/><path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/></svg>`,
    "user-check": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-check"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>`,
};

// Theme Switcher Logic
let currentTheme = null;
try {
    currentTheme = localStorage.getItem('theme');
} catch (e) {}

if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.innerHTML = ICONS.sun;
} else {
    themeToggle.innerHTML = ICONS.moon;
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    let theme = 'dark';
    if (document.body.classList.contains('light-theme')) {
        theme = 'light';
        themeToggle.innerHTML = ICONS.sun;
    } else {
        themeToggle.innerHTML = ICONS.moon;
    }
    try { localStorage.setItem('theme', theme); } catch(e) {}
});

// Shared HTML cleaner
const cleanHtml = (text) => {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```html\s*([\s\S]*?)\s*```$/g, '$1')
                     .replace(/^```\s*([\s\S]*?)\s*```$/g, '$1');
    if (cleaned.startsWith('```html')) {
        cleaned = cleaned.replace(/^```html\s*/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '');
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.replace(/\s*```$/, '');
    }
    return cleaned.trim();
};

const capitalizeFirstLetters = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;

    div.querySelectorAll('p, h2').forEach(el => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        let isFirstTextNode = true;
        let node;

        while ((node = walker.nextNode())) {
            let text = node.textContent;
            if (isFirstTextNode && text.length > 0) {
                const idx = text.search(/[a-zA-Z]/);
                if (idx !== -1) {
                    text = text.substring(0, idx) + text.charAt(idx).toUpperCase() + text.substring(idx + 1);
                }
                isFirstTextNode = false;
            }
            text = text.replace(/([.!?]\s+)([a-z])/g, (m, punct, letter) => punct + letter.toUpperCase());
            node.textContent = text;
        }
    });
    return div.innerHTML;
};

const filterPunctuation = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;

    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        let text = node.textContent;
        text = text.replace(/[—–-]/g, ' ');
        text = text.replace(/[\?\!]/g, '.');
        text = text.replace(/[^a-zA-Z0-9\s,\.']/g, '');
        node.textContent = text;
    }
    return div.innerHTML;
};

// Update Story Viewport Display with dynamic editorial styling and metadata
const updateStoryDisplay = (html) => {
    let formattedHtml = html;
    
    // Fallback: If AI returned a single giant paragraph block, split it programmatically into multiple paragraphs
    const div = document.createElement('div');
    div.innerHTML = formattedHtml;
    const paragraphs = div.querySelectorAll('p');
    if (paragraphs.length === 1) {
        const p = paragraphs[0];
        const text = p.innerText.trim();
        // Split by sentences (matching periods, question marks, or exclamation marks followed by space or end)
        const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g);
        if (sentences && sentences.length > 5) {
            let pBlocks = '';
            let currentPara = [];
            sentences.forEach((sentence, idx) => {
                currentPara.push(sentence.trim());
                // Split every 4 sentences for clean pacing
                if (currentPara.length === 4 || idx === sentences.length - 1) {
                    pBlocks += `<p>${currentPara.join(' ')}</p>`;
                    currentPara = [];
                }
            });
            p.outerHTML = pBlocks;
            formattedHtml = div.innerHTML;
        }
    }

    essayOutput.innerHTML = formattedHtml;
    essayOutput.classList.add('has-story');
    
    // Force a normal safe bottom spacing buffer programmatically
    essayOutput.style.setProperty('padding-bottom', '120px', 'important');
    essayOutput.style.setProperty('display', 'block', 'important');
    
    const h2 = essayOutput.querySelector('h2');
    if (h2) {
        // Calculate words inside paragraphs
        const paragraphs = Array.from(essayOutput.querySelectorAll('p')).map(p => p.innerText.trim());
        const plainText = paragraphs.join(' ');
        const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
        
        // Get current configuration values
        const genre = genreSelect.value;
        const tone = toneSelect.value;
        const ending = endingSelect.value;
        
        // Create metadata layout element
        const metadataHtml = `
            <div class="story-metadata">
                <span>Genre: ${genre}</span>
                <span>Tone: ${tone}</span>
                <span>Ending: ${ending}</span>
                <span>${wordCount} words</span>
            </div>
        `;
        h2.insertAdjacentHTML('afterend', metadataHtml);
    }
};

// Generate Action
generateBtn.addEventListener('click', async () => {
    if (isGenerating) return;

    const topic = topicInput.value.trim();
    if (!topic) {
        alert('Please enter a story concept before generating.');
        return;
    }

    try {
        isGenerating = true;
        generateBtn.disabled = true;
        generateBtn.innerHTML = `
            <span>Writing Story</span>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        
        placeholderSection.classList.add('hidden');
        essayOutput.classList.remove('hidden');
        essayOutput.classList.remove('has-story');
        essayOutput.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Structuring narrative and gathering context...</p>';
        
        // Reset paddings/margins to default during loading
        essayOutput.style.removeProperty('padding-bottom');
        essayOutput.style.removeProperty('margin-bottom');
        const editorArea = document.querySelector('.editor-content-area');
        if (editorArea) {
            editorArea.style.removeProperty('padding-bottom');
        }

        let totalWordTarget = 800;
        const lengthVal = lengthSelect.value;
        if (lengthVal.includes('300')) {
            totalWordTarget = 300;
        } else if (lengthVal.includes('1500')) {
            totalWordTarget = 1500;
        }

        const prompt = `CRITICAL MANDATE: You MUST strictly and faithfully adhere to each of the following configuration options:
                        - Core Concept: "${topic}".
                        - Required Genre: "${genreSelect.value}" (The narrative must strongly represent this genre).
                        - Required Narrative Tone: "${toneSelect.value}" (The vocabulary, description, and character voices must align with this tone).
                        - Required Target Length: Approximately ${totalWordTarget} words.
                        - Required Story Ending Style: The story MUST finish with a "${endingSelect.value}".
                        
                        ${charactersInput.value.trim() ? `- Required Characters: Include these characters and integrate them into the story: "${charactersInput.value.trim()}".` : ''}
                        ${settingInput.value.trim() ? `- Required Setting/Period: Set the story in: "${settingInput.value.trim()}".` : ''}

                        Title Requirement: Start directly with a single <h2> tag containing a creative title for the story. Do NOT use any other headings.
                        Formatting & Completion:
                        1. Structure the story beautifully with multiple well-paced, distinct paragraphs (MUST use at least 4-6 separate paragraphs for Short/Long Stories, and at least 3 separate paragraphs for Flash Fiction). Never return the entire story in a single paragraph block.
                        2. The total word count of the entire story MUST be approximately ${totalWordTarget} words.
                        3. Output the response formatted directly as HTML using <p> tags for all paragraphs and a single <h2> tag at the very beginning for the title.
                        4. Do not include any markdown code block fences (like \`\`\`html) or metadata notes. Start directly with the <h2> tag.
                        5. Ensure that the story is fully completed. Do NOT cut off mid-sentence or mid-paragraph.
                        6. Absolutely NO bold text is allowed (do not use <strong>, <b>, or markdown **). Everything inside paragraphs must be standard weight.
                        7. Absolutely NO long dashes or em-dashes (— or --) are allowed. Use commas or split into separate sentences instead.`;

        const response = await fetchWithTimeout(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: `You are an AI story generator. You MUST write a complete, immersive story that strictly and faithfully adheres to all user configuration rules (Concept, Genre, Narrative Tone, Target Length, Ending style, and optional Characters/Setting).
CRITICAL STYLING & FORMATTING RULES:
1. You MUST write the entire story including the title (wrapped in a single <h2> tag at the very start) and all paragraphs (wrapped in separate <p> tags).
2. The story MUST be partitioned into multiple distinct, well-paced paragraphs (minimum of 3-4 paragraphs for shorter lengths, and 5+ paragraphs for longer lengths). Never output the text as a single giant paragraph block.
3. Output the response formatted directly as raw HTML. Do NOT include any markdown code block fences (like \`\`\`html) or metadata notes. Start directly with the <h2> tag.
4. Absolutely NO bold text is allowed (do not use <strong>, <b>, or markdown **). Everything inside paragraphs must be standard weight.
5. Absolutely NO long dashes or em-dashes (— or --) are allowed. Use commas or split into separate sentences instead.`
                    },
                    { role: 'user', content: prompt }
                ]
            })
        }, 30000, generateBtn, "Writing Story");

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || `API error (HTTP ${response.status})`;
            essayOutput.innerHTML = `<p style="color: #ef4444;">API Error: ${errMsg}</p>`;
            console.error('API Error:', data);
            return;
        }

        if (data.choices && data.choices[0]?.message?.content) {
            let html = cleanHtml(data.choices[0].message.content);

            updateStoryDisplay(html);
            
            humanizeBtn.disabled = false;
            humanizeBtn.innerHTML = `
                ${ICONS["user-check"]}
                <span>Humanize</span>
            `;
        } else {
            const msg = 'No content was returned. Please try again with a different concept.';
            essayOutput.innerHTML = `<p style="color: #ef4444;">${msg}</p>`;
            console.error('Unexpected response:', data);
        }
    } catch (err) {
        essayOutput.innerHTML = '<p style="color: #ef4444;">A network error occurred. Please check your connection and try again.</p>';
        console.error('Network error:', err);
    } finally {
        isGenerating = false;
        generateBtn.disabled = false;
        generateBtn.innerHTML = `
            <span>Generate Story</span>
            ${ICONS.sparkles}
        `;
    }
});

humanizeBtn.addEventListener('click', async () => {
    if (isGenerating) return;
    
    const currentStory = essayOutput.innerHTML.trim();
    if (!currentStory || currentStory.includes('Structuring narrative') || currentStory.includes('API Error')) {
        essayOutput.innerHTML = '<p style="color: #ef4444;">Please generate a story first before humanizing.</p>';
        return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentStory;
    
    const paragraphTexts = Array.from(tempDiv.querySelectorAll('p')).map(p => p.innerText.trim());
    const titleText = (tempDiv.querySelector('h2')?.innerText || '').trim();
    const plainStory = (titleText ? `Title: ${titleText}\n\n` : '') + paragraphTexts.join('\n\n');

    const originalWordCount = plainStory.trim().split(/\s+/).filter(Boolean).length || 500;

    try {
        isGenerating = true;
        humanizeBtn.disabled = true;
        humanizeBtn.innerHTML = `
            <span>Humanizing</span>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        
        essayOutput.classList.remove('has-story');
        essayOutput.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Humanizing text to bypass AI detectors...</p>';
        
        // Reset paddings/margins to default during loading
        essayOutput.style.removeProperty('padding-bottom');
        essayOutput.style.removeProperty('margin-bottom');
        const editorArea = document.querySelector('.editor-content-area');
        if (editorArea) {
            editorArea.style.removeProperty('padding-bottom');
        }

        const response = await fetchWithTimeout(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: `Before you write, perform a critical humanization rewrite to guarantee the final text completely bypasses all AI detectors (like ZeroGPT, Turnitin, GPTZero). Bypass AI detectors by breaking the predictable, uniform patterns that machine learning models rely on to flag text.

STAGE 2: CRITICAL HUMANIZATION (ANTI-AI DETECTION)
You must completely rewrite the story using these actionable editing techniques:

0. User Configuration Rules (MANDATORY COMPLIANCE):
    - Core Concept: Maintain the concept: "${topicInput.value.trim()}".
    - Required Genre: Strictly preserve the "${genreSelect.value}" genre styling and tropes.
    - Required Narrative Tone: Keep the "${toneSelect.value}" tone active in the rewrite.
    - Required Story Ending: Preserve the "${endingSelect.value}" style ending.

1. Short Words & Short Sentences (Simple Grammar): A real human typing quickly wants to save time. They avoid long words and long sentences. You MUST use short, everyday words (1-2 syllables). Keep your logic simple and your grammar extremely clear and easy to understand. To maintain burstiness, mix ultra-short sentences (2-4 words) with basic sentences (8-12 words), but completely avoid complex, winding lines and long vocabulary.

2. Conceptual Depth: Inject highly specific, concrete details and nuanced observations that a predictive language model cannot generate. Avoid vague generalizations.

3. Ban AI Buzzwords & Metaphors (Perplexity Hack): AI writes using generic, grandiose metaphors to sound profound. You MUST completely avoid words and phrases like "tapestry", "unbroken march", "ripple effect", "ancient legacies", "modern aspirations", "delve", "testament to", "crucial role", or "realm". Never use grand, poetic metaphors. Write literally, directly, and plainly, like a human explaining something at a bar, not an epic movie trailer.

4. Kill the "Perfect" Transitions: AI predictably relies on words like "However", "Therefore", "Moreover", "Consequently", and "Furthermore". You must organically remove 80% of these transition words. When a transition is absolutely necessary, use abrupt, direct phrasing rather than formal filler.

5. Ban Syntactic Symmetry & Anaphora: Do NOT start consecutive sentences with the same word or phrase. Break up perfectly balanced paragraph structures. Make the structure highly asymmetrical, avoiding parallel lists or perfectly summarizing conclusions.

6. Incorporate active voice: Convert passive, clinical sentences into direct, action-oriented statements to convey strong momentum.

7. Introduce "Cognitive Scars" (Mistakes): AI text is surgically clean. You must add the things tired human writers do. Include occasional "cognitive scars" such as:
   - The False Start: Re-framing a point mid-thought (e.g., "The main issue here—or rather, the more pressing concern—is...").
   - The Tangent: Including a sentence that is only marginally relevant before awkwardly pulling back to the main point.
   - The Awkward Phrase: Use slightly clunky, imperfect sentence structures that make logical sense but lack elegant AI polish.

8. STYLE ANCHOR (FEW-SHOT EXAMPLE):
   To understand the exact style, vocabulary level, and syntactic clumsiness you MUST mimic, study this 100% human-written example. Notice the complete lack of transitions, the basic vocabulary ("very old place"), the awkward phrasing, and the lack of complex opening clauses:
   "There is no other National identity like India’s in this world. It is also a very old place full of culture that is more than just its geography. Indian geography goes from north to south about 4,000 miles (6,400 km). The height of north of India has snow capped mountains and the south has warm, sunny beaches. This range in height and geography can be seen through the variety of languages, ethnic groups, and customs in all parts of India. The ever changing nature of cultural patterns has developed over an extended period and is still developing today. To study cultural patterns of National Identity in India requires consideration of their economy, social structure and global influence."

10. Paragraph Distribution: The humanized output MUST preserve or enhance the multi-paragraph structure of the input story. You MUST output the story partitioned into multiple separate, well-paced paragraphs (minimum of 3-6 paragraphs). Never collapse the rewritten text into a single paragraph block.

OUTPUT REQUIREMENT:
Only output the final, fully humanized story formatted directly as HTML (<h2> for the title, <p> for the paragraphs). The rewritten story MUST consist of multiple distinct, well-spaced paragraphs. Do not output any markdown code blocks, labels, or explanations. Start directly with the <h2> tag.`
                    },
                    {
                        role: 'user',
                        content: `Please rewrite the following story to fully humanize it according to the system instructions. Do not change the general plot, but completely rephrase the sentences and vocabulary to ensure it sounds like a human and bypasses all AI detectors.

Word count constraint: Your humanized output MUST contain between ${originalWordCount - 15} and ${originalWordCount + 15} words (the input has exactly ${originalWordCount} words). Do not summarize or shorten any section.

Story:
${plainStory}`
                    }
                ]
            })
        }, 30000, humanizeBtn, "Humanizing");

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || `API error (HTTP ${response.status})`;
            essayOutput.innerHTML = currentStory; 
            essayOutput.insertAdjacentHTML('afterbegin', `<p style="color:#ef4444;margin-bottom:1rem;">Humanizer Error: ${errMsg}</p>`);
            return;
        }

        if (data.choices && data.choices[0]?.message?.content) {
            let html = cleanHtml(data.choices[0].message.content);
            html = capitalizeFirstLetters(html);
            html = filterPunctuation(html);

            updateStoryDisplay(html);
            
            humanizeBtn.disabled = true;
            humanizeBtn.innerHTML = `
                ${ICONS.check}
                <span>Humanized!</span>
            `;
            triggerFeedbackModalOnce();
        } else {
            essayOutput.innerHTML = currentStory; 
            essayOutput.insertAdjacentHTML('afterbegin', '<p style="color:#ef4444;margin-bottom:1rem;">No humanized content was returned. Please try again.</p>');
        }
    } catch (err) {
        essayOutput.innerHTML = currentStory; 
        essayOutput.insertAdjacentHTML('afterbegin', '<p style="color:#ef4444;margin-bottom:1rem;">Network error during humanization. Please try again.</p>');
        console.error('Humanizer Network error:', err);
    } finally {
        isGenerating = false;
        if (!humanizeBtn.innerHTML.includes('Humanized')) {
            humanizeBtn.disabled = false;
            humanizeBtn.innerHTML = `
                ${ICONS["user-check"]}
                <span>Humanize</span>
            `;
        }
    }
});

copyBtn.addEventListener('click', () => {
    // Clone output viewport to strip metadata from copied text
    const clone = essayOutput.cloneNode(true);
    const metadata = clone.querySelector('.story-metadata');
    if (metadata) metadata.remove();
    
    const text = clone.innerText;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `${ICONS.check}<span>Copied!</span>`;
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
});

function initFeedbackModal() {
    const feedbackModal = document.getElementById('feedbackModal');
    if (!feedbackModal) return;

    const starBtns = feedbackModal.querySelectorAll('.star-btn');
    const commentField = document.getElementById('feedbackComment');
    const submitBtn = document.getElementById('feedbackSubmitBtn');
    const cancelBtn = document.getElementById('feedbackCancelBtn');
    const closeBtn = document.getElementById('feedbackCloseBtn');
    const feedbackForm = document.getElementById('feedbackForm');
    const successState = document.getElementById('feedbackSuccessState');

    let currentRating = 0;

    starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const rating = parseInt(btn.getAttribute('data-rating'), 10);
            currentRating = rating;
            
            starBtns.forEach(sBtn => {
                const sRating = parseInt(sBtn.getAttribute('data-rating'), 10);
                if (sRating <= rating) {
                    sBtn.classList.add('active');
                } else {
                    sBtn.classList.remove('active');
                }
            });

            submitBtn.disabled = false;
        });
    });

    const closeModal = () => {
        feedbackModal.classList.remove('active');
    };

    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    feedbackModal.addEventListener('click', (e) => {
        if (e.target === feedbackModal) {
            closeModal();
        }
    });

    feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (currentRating === 0) return;

        submitBtn.disabled = true;
        starBtns.forEach(btn => btn.disabled = true);
        commentField.disabled = true;

        submitBtn.innerHTML = `
            <span>Submitting</span>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        `;

        setTimeout(() => {
            console.log('Feedback submitted:', {
                rating: currentRating,
                comment: commentField.value.trim()
            });

            successState.classList.add('active');

            setTimeout(() => {
                closeModal();
            }, 1800);
        }, 1000);
    });
}

function triggerFeedbackModalOnce() {
    const feedbackModal = document.getElementById('feedbackModal');
    if (!feedbackModal) return;

    let prompted = false;
    try {
        prompted = localStorage.getItem('storyai_feedback_prompted') === 'true';
    } catch(e) {}
    
    if (!prompted) {
        try {
            localStorage.setItem('storyai_feedback_prompted', 'true');
        } catch(e) {}
        setTimeout(() => {
            feedbackModal.classList.add('active');
        }, 1500);
    }
}

initFeedbackModal();

// Custom Dropdowns (Premium Luxury Replacement)
function initCustomDropdowns() {
    const selects = document.querySelectorAll('.sidebar select');
    
    selects.forEach(select => {
        // Prevent double-initialization
        if (select.previousElementSibling && select.previousElementSibling.classList.contains('select-custom')) {
            return;
        }
        
        // Create custom select wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'select-custom';
        
        // Create trigger element
        const trigger = document.createElement('div');
        trigger.className = 'select-custom-trigger';
        
        const label = document.createElement('span');
        // Get selected option text
        const selectedOption = select.options[select.selectedIndex];
        label.textContent = selectedOption ? selectedOption.textContent : '';
        
        const chevron = document.createElement('div');
        chevron.className = 'chevron-icon';
        chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
        
        trigger.appendChild(label);
        trigger.appendChild(chevron);
        wrapper.appendChild(trigger);
        
        // Create options container
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'select-custom-options';
        
        // Populate options
        Array.from(select.options).forEach(opt => {
            const optDiv = document.createElement('div');
            optDiv.className = 'select-custom-option';
            optDiv.textContent = opt.textContent;
            optDiv.dataset.value = opt.value;
            
            if (opt.selected) {
                optDiv.classList.add('selected');
            }
            
            optDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                // Select value in native select
                select.value = opt.value;
                // Dispatch change event
                select.dispatchEvent(new Event('change'));
                
                // Update trigger text
                label.textContent = opt.textContent;
                
                // Update active state in list
                optionsContainer.querySelectorAll('.select-custom-option').forEach(item => {
                    item.classList.remove('selected');
                });
                optDiv.classList.add('selected');
                
                // Close dropdown
                wrapper.classList.remove('open');
            });
            
            optionsContainer.appendChild(optDiv);
        });
        
        wrapper.appendChild(optionsContainer);
        
        // Insert wrapper right before select
        select.parentNode.insertBefore(wrapper, select);
        // Hide native select
        select.style.display = 'none';
        
        // Toggle dropdown open
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Close all other dropdowns first
            document.querySelectorAll('.select-custom').forEach(item => {
                if (item !== wrapper) item.classList.remove('open');
            });
            
            wrapper.classList.toggle('open');
        });
    });
    
    // Close dropdowns on clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.select-custom').forEach(item => {
            item.classList.remove('open');
        });
    });
}

initCustomDropdowns();

// Advanced Parameters Accordion Toggle
function initAdvancedAccordion() {
    const toggle = document.getElementById('advancedToggle');
    const content = document.getElementById('advancedContent');
    if (!toggle || !content) return;
    
    toggle.addEventListener('click', () => {
        const accordion = toggle.closest('.advanced-accordion');
        if (accordion) {
            accordion.classList.toggle('open');
        }
    });
}

initAdvancedAccordion();
