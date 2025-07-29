class InfiniteAIStory {
    constructor() {
        // --- CONFIGURATION ---
        this.API_KEY = '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'; // Vercel will replace this with your secret Environment Variable
        this.API_URL = 'https://api.groq.com/openai/v1/chat/completions';
        this.API_MODEL = 'llama-3.1-8b-instant';
        this.DAILY_LIMIT = 45;

        // --- Element Cache ---
        this.elements = {
            introScreen: document.getElementById('intro-screen'),
            storyContent: document.getElementById('story-content'),
            choicesPanel: document.getElementById('choices-panel'),
            rateLimitScreen: document.getElementById('rate-limit-screen'),
            storyCount: document.getElementById('story-count'),
            twistCount: document.getElementById('twist-count'),
            romanceCount: document.getElementById('romance-count'),
            snowCount: document.getElementById('snow-count'),
            coupleStatus: document.getElementById('couple-status'),
            heartCount: document.getElementById('heart-count'),
            memoryList: document.getElementById('memory-list'),
            snowCommentary: document.getElementById('snow-commentary'),
            vibeMeters: {
                mystery: document.getElementById('mystery-fill'),
                romance: document.getElementById('romance-fill'),
                chaos: document.getElementById('chaos-fill'),
                tension: document.getElementById('tension-fill'),
            }
        };
        
        // --- Game State ---
        this.gameState = null;
        this.rateLimitInfo = null;

        this.init();
    }

    // 1. INITIALIZATION & GAME STATE
    init() {
        this.loadRateLimitInfo();
        this.loadGameState();

        if (this.isRateLimited()) {
            this.showRateLimitScreen();
        } else if (this.gameState.storyHistory.length > 0) {
            this.continueGame();
        } else {
            this.displayIntroScreen();
        }
        
        this.bindEvents();
        this.updateAllUI();
    }
    
    loadGameState() {
        const savedState = localStorage.getItem('groqAIStoryState');
        if (savedState) {
            this.gameState = JSON.parse(savedState);
        } else {
            this.gameState = this.getNewGameState();
        }
    }
    
    saveGameState() {
        localStorage.setItem('groqAIStoryState', JSON.stringify(this.gameState));
    }
    
    getNewGameState() {
        return {
            storyHistory: [],
            currentVibes: { mystery: 50, romance: 30, chaos: 20, tension: 40 },
            relationshipLevel: 1,
            stats: { stories: 0, twists: 0, romance: 0, snow: 0 },
            memories: [],
        };
    }

    bindEvents() {
        document.getElementById('start-infinite').addEventListener('click', () => this.startNewGame());
        document.getElementById('save-moment').addEventListener('click', () => this.saveCurrentMoment());
        document.getElementById('relationship-status').addEventListener('click', () => this.showRelationshipStatus());
        document.getElementById('new-timeline').addEventListener('click', () => this.startNewTimeline());
        document.getElementById('hard-reset').addEventListener('click', () => this.hardResetGame());
    }

    // 2. CORE AI & STORY GENERATION
    async generateNextStorySegment(playerChoice) {
        if (this.isRateLimited()) {
            this.showRateLimitScreen();
            return;
        }

        this.showLoadingState();
        this.incrementAPICall();

        const prompt = this.createLLMPrompt(playerChoice);

        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.API_KEY}` },
                body: JSON.stringify({
                    model: this.API_MODEL,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.8,
                    max_tokens: 300
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

            const data = await response.json();
            const content = data.choices[0].message.content;
            this.parseAIResponse(content);
        } catch (error) {
            console.error("Error fetching AI response:", error);
            this.displayErrorState("The story AI is feeling shy. Please try again.");
        }
        
        this.saveGameState();
        this.updateAllUI();
    }
    
    createLLMPrompt(playerChoice) {
        const history = this.gameState.storyHistory.slice(-5).map(item => `> ${item.text}`).join('\n');
        return `
You are a creative, Gen Z-style AI storyteller. Your task is to continue a romantic mystery story about a couple, Ayman and Aadi, and their chaotic white cat, Snow.

**CHARACTER BACKGROUNDS:**
Ayman is from Pakistan. Aadi is from India. Subtly weave their cultural backgrounds into the story with humor and warmth.

**RULES:**
- Use simple, easy-to-understand English. The vibe is fun and casual, not complex.
- Your tone must be modern, addictive, and use Gen Z slang (like 'no cap', 'it's giving', 'the audacity').
- The story should feel like it could continue forever.
- Your entire response MUST strictly follow this format:
STORY: [The next 2-3 sentences of the story.]
VIBE: [Choose one: romantic, mysterious, chaotic, tense]
SNOW: [A short, funny thought from Snow, the cat.]
CHOICE 1: [A compelling choice for the player.]
CHOICE 2: [Another compelling choice.]
CHOICE 3: [A third compelling choice.]

---
**PREVIOUS STORY MOMENTS:**
${history}

---
**PLAYER'S LAST CHOICE:**
"${playerChoice}"

Now, generate the next part of the story.`;
    }

    parseAIResponse(response) {
        const storyMatch = response.match(/STORY:\s*([\s\S]*?)\s*VIBE:/);
        const vibeMatch = response.match(/VIBE:\s*(\w+)/);
        const snowMatch = response.match(/SNOW:\s*([\s\S]*?)\s*CHOICE/);
        const choiceMatches = [...response.matchAll(/CHOICE\s*\d:\s*([\s\S]*?)(?=\nCHOICE|\n*$)/g)];

        if (!storyMatch || !vibeMatch || !snowMatch || choiceMatches.length < 3) {
            console.error("Invalid AI response format:", response);
            this.displayErrorState("The AI gave a weird response. Let's try again.");
            this.rateLimitInfo.callsToday--;
            this.saveRateLimitInfo();
            return;
        }

        const storyText = storyMatch[1].trim();
        const storyVibe = vibeMatch[1].trim().toLowerCase();
        const snowThought = snowMatch[1].trim();
        const choices = choiceMatches.map(match => match[1].trim());

        this.updateGameState(storyText, storyVibe);
        this.displayStory(storyText, storyVibe);
        this.displayChoices(choices);
        this.elements.snowCommentary.textContent = snowThought;
    }
    
    updateGameState(storyText, storyVibe) {
        this.gameState.storyHistory.push({ text: storyText, vibe: storyVibe });
        this.gameState.stats.stories++;
        if (this.gameState.currentVibes[storyVibe]) {
            this.gameState.currentVibes[storyVibe] = Math.min(100, this.gameState.currentVibes[storyVibe] + 15);
        } else {
            this.gameState.currentVibes.mystery = Math.min(100, this.gameState.currentVibes.mystery + 10);
        }
        if (storyVibe === 'romantic') this.gameState.stats.romance++;
        if (storyVibe === 'mysterious') this.gameState.stats.twists++;
        if (storyVibe === 'chaotic') this.gameState.stats.snow++;
        if (this.gameState.currentVibes.romance > 85 && this.gameState.relationshipLevel < 5) {
            this.gameState.relationshipLevel++;
            this.gameState.currentVibes.romance = 30;
            this.addMemory(`💕 Relationship Level Up! 💕`);
        }
    }

    // 3. GAME FLOW & UI MANAGEMENT
    startNewGame() {
        this.gameState = this.getNewGameState();
        this.gameState.storyHistory.push({ text: "The adventure begins...", vibe: "mysterious" });
        this.addMemory("A new timeline begins...");
        this.showGamePanels();
        this.generateNextStorySegment("Let's start our story.");
    }
    
    continueGame() {
        this.showGamePanels();
        const lastStory = this.gameState.storyHistory[this.gameState.storyHistory.length - 1];
        this.displayStory(lastStory.text, lastStory.vibe);
        this.generateNextStorySegment("...what happens next?");
    }
    
    showGamePanels() {
        this.elements.introScreen.style.display = 'none';
        this.elements.rateLimitScreen.style.display = 'none';
        this.elements.storyContent.style.display = 'block';
        this.elements.choicesPanel.style.display = 'block';
    }

    displayStory(text, type) {
        const storySegment = document.createElement('div');
        storySegment.className = `story-segment ${type}-moment`;
        storySegment.innerHTML = text;
        this.elements.storyContent.innerHTML = '';
        this.elements.storyContent.appendChild(storySegment);
    }

    displayChoices(choices) {
        const choicesGrid = document.getElementById('story-choices');
        choicesGrid.innerHTML = '';
        choices.forEach(choiceText => {
            const button = document.createElement('button');
            button.className = 'choice-btn';
            button.textContent = choiceText;
            button.addEventListener('click', () => this.generateNextStorySegment(choiceText));
            choicesGrid.appendChild(button);
        });
    }
    
    displayIntroScreen() {
        this.elements.introScreen.style.display = 'block';
        this.elements.storyContent.style.display = 'none';
        this.elements.choicesPanel.style.display = 'none';
        this.elements.rateLimitScreen.style.display = 'none';
    }
    
    showRateLimitScreen() {
        this.saveGameState();
        this.elements.introScreen.style.display = 'none';
        this.elements.storyContent.style.display = 'none';
        this.elements.choicesPanel.style.display = 'none';
        this.elements.rateLimitScreen.style.display = 'block';
    }

    // 4. RATE LIMITING
    loadRateLimitInfo() {
        const savedLimitInfo = localStorage.getItem('groqAILimitInfo');
        if (savedLimitInfo) {
            this.rateLimitInfo = JSON.parse(savedLimitInfo);
            const today = new Date().toISOString().split('T')[0];
            if (this.rateLimitInfo.lastCallDate !== today) {
                this.rateLimitInfo.callsToday = 0;
                this.rateLimitInfo.lastCallDate = today;
            }
        } else {
            this.rateLimitInfo = { callsToday: 0, lastCallDate: new Date().toISOString().split('T')[0] };
        }
    }
    
    saveRateLimitInfo() {
        localStorage.setItem('groqAILimitInfo', JSON.stringify(this.rateLimitInfo));
    }
    
    isRateLimited() {
        return this.rateLimitInfo.callsToday >= this.DAILY_LIMIT;
    }
    
    incrementAPICall() {
        this.rateLimitInfo.callsToday++;
        this.saveRateLimitInfo();
    }
    
    // 5. FULLY IMPLEMENTED CONTROLS & UI
    updateAllUI() {
        this.elements.storyCount.textContent = this.gameState.stats.stories;
        this.elements.twistCount.textContent = this.gameState.stats.twists;
        this.elements.romanceCount.textContent = this.gameState.stats.romance;
        this.elements.snowCount.textContent = this.gameState.stats.snow;

        const relationshipTexts = ["strangers with cute cats", "getting to know each other", "definitely vibing", "catching serious feelings", "relationship goals fr", "soulmates (Snow approved)"];
        this.elements.coupleStatus.textContent = relationshipTexts[this.gameState.relationshipLevel] || relationshipTexts[0];
        this.elements.heartCount.textContent = '💕'.repeat(this.gameState.relationshipLevel);

        Object.keys(this.elements.vibeMeters).forEach(vibe => {
            if (this.elements.vibeMeters[vibe] && this.gameState.currentVibes[vibe]) {
                this.elements.vibeMeters[vibe].style.width = `${this.gameState.currentVibes[vibe]}%`;
            }
        });
        
        this.updateMemoryList();
    }
    
    addMemory(memoryText) {
        if (!this.gameState.memories) this.gameState.memories = [];
        this.gameState.memories.push(memoryText);
        if (this.gameState.memories.length > 10) this.gameState.memories.shift();
        this.updateMemoryList();
    }

    updateMemoryList() {
        const memoryHint = this.elements.memoryList.querySelector('.memory-hint');
        if (this.gameState.memories && this.gameState.memories.length > 0) {
            if (memoryHint) memoryHint.style.display = 'none';
            this.elements.memoryList.innerHTML = this.gameState.memories.map(mem => `<div class="memory-item">${mem}</div>`).join('');
            this.elements.memoryList.scrollTop = this.elements.memoryList.scrollHeight;
        } else {
            if(memoryHint) memoryHint.style.display = 'block';
            this.elements.memoryList.innerHTML = `<p class="memory-hint">your story memories will appear here...</p>`;
        }
    }
    
    showLoadingState() {
        document.getElementById('story-choices').innerHTML = `<div class="loading-dots">AI is writing...</div>`;
    }

    displayErrorState(message) {
        document.getElementById('story-choices').innerHTML = `<p style="color: #e94560;">${message}</p>`;
    }
    
    saveCurrentMoment() {
        const lastStory = this.gameState.storyHistory.slice(-1)[0];
        if (!lastStory) {
            alert("Nothing to save yet!");
            return;
        }
        this.addMemory(`📸 Saved: "${lastStory.text.substring(0, 30)}..."`);
        this.saveGameState();
        alert("This moment has been added to your core memories!");
    }

    showRelationshipStatus() {
        const status = `
        💕 Ayman & Aadi Status Report 💕
        ------------------------------------
        Relationship Level: ${this.elements.coupleStatus.textContent} (${this.gameState.relationshipLevel}/5)
        Romantic Moments: ${this.gameState.stats.romance}
        Mysterious Events: ${this.gameState.stats.twists}
        Snow's Chaos Level: ${this.gameState.stats.snow}
        ------------------------------------
        Snow's Current Thought: ${this.elements.snowCommentary.textContent}
        `;
        alert(status);
    }
    
    startNewTimeline() {
        if (confirm("Are you sure you want to start a new timeline? This will erase your current story.")) {
            this.startNewGame();
        }
    }

    hardResetGame() {
        if (confirm("🔥 Are you ABSOLUTELY sure? 🔥\n\nThis will delete ALL saved progress and rate limit data permanently. The story will be completely reset as if you're playing for the first time.")) {
            localStorage.removeItem('groqAIStoryState');
            localStorage.removeItem('groqAILimitInfo');
            window.location.reload();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new InfiniteAIStory();
});
