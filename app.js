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
const outputCard = document.getElementById('outputCard');
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
let topicGuard = localStorage.getItem('storyTopic') || '';
if (topicGuard) topicInput.value = topicGuard;

topicInput.addEventListener('input', () => {
    if (topicInput.value) topicGuard = topicInput.value;
    localStorage.setItem('storyTopic', topicInput.value);
});

// Restore topic immediately if any control change clears it
[genreSelect, toneSelect, lengthSelect, endingSelect, charactersInput, settingInput].forEach(el => {
    el.addEventListener('change', () => {
        if (!topicInput.value && topicGuard) {
            topicInput.value = topicGuard;
        }
    });
});

// Theme Switcher Logic
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.innerHTML = '<i data-lucide="sun"></i>';
} else {
    themeToggle.innerHTML = '<i data-lucide="moon"></i>';
}
lucide.createIcons();

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    let theme = 'dark';
    if (document.body.classList.contains('light-theme')) {
        theme = 'light';
        themeToggle.innerHTML = '<i data-lucide="sun"></i>';
    } else {
        themeToggle.innerHTML = '<i data-lucide="moon"></i>';
    }
    localStorage.setItem('theme', theme);
    lucide.createIcons();
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
        
        outputCard.classList.remove('hidden');
        essayOutput.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Structuring narrative and gathering context...</p>';
        outputCard.scrollIntoView({ behavior: 'smooth' });

        let totalWordTarget = 800;
        const lengthVal = lengthSelect.value;
        if (lengthVal.includes('300')) {
            totalWordTarget = 300;
        } else if (lengthVal.includes('1500')) {
            totalWordTarget = 1500;
        }

        const prompt = `You MUST strictly follow these user configuration rules to write a compelling story:
                        1. Core Concept: Write a story based on this concept: "${topic}".
                        2. Genre: The story genre is "${genreSelect.value}".
                        3. Tone: Adhere strictly to a "${toneSelect.value}" narrative tone.
                        4. Target Length: Write approximately ${totalWordTarget} words in total.
                        5. Ending: The story MUST end with a "${endingSelect.value}".
                        
                        ${charactersInput.value.trim() ? `6. Main Characters (Optional Rule): Include these characters: "${charactersInput.value.trim()}".` : ''}
                        ${settingInput.value.trim() ? `7. Setting (Optional Rule): The story must be set in: "${settingInput.value.trim()}".` : ''}

                        Heading/Title Requirement: You MUST start the story with a single <h2> heading containing a creative, engaging title for the story. Do NOT use any other <h2> tags or subheadings anywhere else.
                         
                        Formatting & Completion:
                        1. Structure the story beautifully with well-paced paragraphs.
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
                        content: `You are an AI story generator. Write a complete, immersive story based on the concept and options.
CRITICAL: You MUST write the entire story including the title (in a single <h2> tag) and all paragraphs (in separate <p> tags).
Output the response formatted directly as HTML. Do NOT include any markdown code block fences (like \`\`\`html) or metadata notes. Start directly with the <h2> tag.
Absolutely NO bold text is allowed. Everything must be standard weight.
Absolutely NO long dashes or em-dashes (— or --) are allowed.`
                    },
                    { role: 'user', content: prompt }
                ]
            })
        }, 30000, generateBtn, "Writing Story");

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || \`API error (HTTP \${response.status})\`;
            essayOutput.innerHTML = \`<p style="color: #ef4444;">API Error: \${errMsg}</p>\`;
            console.error('API Error:', data);
            return;
        }

        if (data.choices && data.choices[0]?.message?.content) {
            let html = cleanHtml(data.choices[0].message.content);

            essayOutput.innerHTML = html;
            
            humanizeBtn.disabled = false;
            humanizeBtn.innerHTML = \`
                <i data-lucide="wand-2"></i>
                <span>Humanize</span>
            \`;
            lucide.createIcons();
        } else {
            const msg = 'No content was returned. Please try again with a different concept.';
            essayOutput.innerHTML = \`<p style="color: #ef4444;">\${msg}</p>\`;
            console.error('Unexpected response:', data);
        }
    } catch (err) {
        essayOutput.innerHTML = '<p style="color: #ef4444;">A network error occurred. Please check your connection and try again.</p>';
        console.error('Network error:', err);
    } finally {
        isGenerating = false;
        generateBtn.disabled = false;
        generateBtn.innerHTML = \`
            <span>Generate Story</span>
            <i data-lucide="sparkles"></i>
        \`;
        lucide.createIcons();
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
    const plainStory = (titleText ? \`Title: \${titleText}\n\n\` : '') + paragraphTexts.join('\n\n');

    const originalWordCount = plainStory.trim().split(/\\s+/).filter(Boolean).length || 500;

    try {
        isGenerating = true;
        humanizeBtn.disabled = true;
        humanizeBtn.innerHTML = \`
            <span>Humanizing</span>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        \`;
        
        essayOutput.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Humanizing text to bypass AI detectors...</p>';

        const response = await fetchWithTimeout(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: \`Before you write, perform a critical humanization rewrite to guarantee the final text completely bypasses all AI detectors (like ZeroGPT, Turnitin, GPTZero). Bypass AI detectors by breaking the predictable, uniform patterns that machine learning models rely on to flag text.

STAGE 2: CRITICAL HUMANIZATION (ANTI-AI DETECTION)
You must completely rewrite the story using these actionable editing techniques:

0. User Configuration Rules (MUST FOLLOW):
   - Concept: Stay strictly on the concept: "\${topicInput.value.trim()}".
   - Genre: Adhere to the "\${genreSelect.value}" genre.
   - Tone: Maintain the "\${toneSelect.value}" tone.
   - Ending: Keep the "\${endingSelect.value}".

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

9. Word Count: Your humanized output MUST be between \${originalWordCount - 15} and \${originalWordCount + 15} words.

OUTPUT REQUIREMENT:
Only output the final, fully humanized story formatted directly as HTML (<h2> for the title, <p> for the paragraphs). Do not output any markdown code blocks, labels, or explanations. Start directly with the <h2> tag.\`
                    },
                    {
                        role: 'user',
                        content: \`Please rewrite the following story to fully humanize it according to the system instructions. Do not change the general plot, but completely rephrase the sentences and vocabulary to ensure it sounds like a human and bypasses all AI detectors.

Word count constraint: Your humanized output MUST contain between \${originalWordCount - 15} and \${originalWordCount + 15} words (the input has exactly \${originalWordCount} words). Do not summarize or shorten any section.

Story:
\${plainStory}\`
                    }
                ]
            })
        }, 30000, humanizeBtn, "Humanizing");

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || \`API error (HTTP \${response.status})\`;
            essayOutput.innerHTML = currentStory; 
            essayOutput.insertAdjacentHTML('afterbegin', \`<p style="color:#ef4444;margin-bottom:1rem;">Humanizer Error: \${errMsg}</p>\`);
            return;
        }

        if (data.choices && data.choices[0]?.message?.content) {
            let html = cleanHtml(data.choices[0].message.content);
            html = capitalizeFirstLetters(html);
            html = filterPunctuation(html);

            essayOutput.innerHTML = html;
            
            humanizeBtn.disabled = true;
            humanizeBtn.innerHTML = \`
                <i data-lucide="check"></i>
                <span>Humanized!</span>
            \`;
            lucide.createIcons();
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
            humanizeBtn.innerHTML = \`
                <i data-lucide="wand-2"></i>
                <span>Humanize</span>
            \`;
            lucide.createIcons();
        }
    }
});

copyBtn.addEventListener('click', () => {
    const text = essayOutput.innerText;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i data-lucide="check"></i><span>Copied!</span>';
        lucide.createIcons();
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            lucide.createIcons();
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

        submitBtn.innerHTML = \`
            <span>Submitting</span>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        \`;

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

    const prompted = localStorage.getItem('storyai_feedback_prompted');
    if (!prompted) {
        localStorage.setItem('storyai_feedback_prompted', 'true');
        setTimeout(() => {
            feedbackModal.classList.add('active');
        }, 1500);
    }
}

initFeedbackModal();
