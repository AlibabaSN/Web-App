// Spaced repetition intervals (in days)
const intervals = {
    hard: [1, 3, 7],
    good: [2, 5, 10],
    easy: [3, 7, 14]
};

class Card {
    constructor(front, back) {
        this.front = front;
        this.back = back;
        this.level = 0;
        this.nextReview = new Date();
        this.reviewHistory = [];
    }
}

class Deck {
    constructor(title) {
        this.title = title;
        this.cards = [];
        this.created = new Date();
    }

    addCard(front, back) {
        this.cards.push(new Card(front, back));
    }

    getDueCards() {
        const now = new Date();
        return this.cards.filter(card => card.nextReview <= now);
    }
}

// App state
let decks = [];
let currentDeck = null;
let currentCard = null;

// DOM Elements
const sections = {
    deckList: document.getElementById('deckList'),
    createDeck: document.getElementById('createDeck'),
    review: document.getElementById('reviewSection'),
    stats: document.getElementById('statsSection')
};

// Initialize from localStorage
function initializeApp() {
    const savedDecks = localStorage.getItem('flashcards');
    if (savedDecks) {
        decks = JSON.parse(savedDecks).map(deck => {
            const newDeck = new Deck(deck.title);
            newDeck.cards = deck.cards.map(card => {
                const newCard = new Card(card.front, card.back);
                newCard.level = card.level;
                newCard.nextReview = new Date(card.nextReview);
                newCard.reviewHistory = card.reviewHistory;
                return newCard;
            });
            return newDeck;
        });
    }
    renderDecks();
    updateStats();
}

// Event Listeners
document.getElementById('createDeckBtn').addEventListener('click', () => showSection('createDeck'));
document.getElementById('statsBtn').addEventListener('click', () => showSection('stats'));
document.getElementById('addCardBtn').addEventListener('click', addCardInput);
document.getElementById('newDeckForm').addEventListener('submit', createDeck);
document.getElementById('flipBtn').addEventListener('click', flipCard);

// Add event listeners for difficulty buttons
document.querySelectorAll('.difficulty').forEach(btn => {
    btn.addEventListener('click', () => processAnswer(btn.classList[2]));
});

function showSection(sectionId) {
    Object.values(sections).forEach(section => section.classList.add('hidden'));
    sections[sectionId].classList.remove('hidden');
    if (sectionId === 'stats') {
        updateStats();
    }
}

function addCardInput() {
    const container = document.getElementById('cardsContainer');
    const cardInput = document.createElement('div');
    cardInput.className = 'card-input';
    cardInput.innerHTML = `
        <input type="text" placeholder="Front" required>
        <input type="text" placeholder="Back" required>
    `;
    container.appendChild(cardInput);
}

function createDeck(e) {
    e.preventDefault();
    const title = document.getElementById('deckTitle').value;
    const deck = new Deck(title);
    
    const cardInputs = document.querySelectorAll('.card-input');
    cardInputs.forEach(input => {
        const [front, back] = input.querySelectorAll('input');
        deck.addCard(front.value, back.value);
    });
    
    decks.push(deck);
    saveDecksToDisk();
    renderDecks();
    showSection('deckList');
    e.target.reset();
    document.getElementById('cardsContainer').innerHTML = `
        <div class="card-input">
            <input type="text" placeholder="Front" required>
            <input type="text" placeholder="Back" required>
        </div>
    `;
}

function renderDecks() {
    const container = document.getElementById('decksContainer');
    container.innerHTML = '';
    
    decks.forEach((deck, index) => {
        const dueCards = deck.getDueCards().length;
        const deckElement = document.createElement('div');
        deckElement.className = 'deck-card';
        deckElement.innerHTML = `
            <h3>${deck.title}</h3>
            <p>${deck.cards.length} cards</p>
            <p>${dueCards} cards due</p>
        `;
        deckElement.addEventListener('click', () => startReview(index));
        container.appendChild(deckElement);
    });
}

function startReview(deckIndex) {
    currentDeck = decks[deckIndex];
    const dueCards = currentDeck.getDueCards();
    
    if (dueCards.length === 0) {
        alert('No cards due for review!');
        return;
    }
    
    currentCard = dueCards[0];
    showSection('review');
    displayCard();
}

function displayCard() {
    const frontElement = document.getElementById('cardFront');
    const backElement = document.getElementById('cardBack');
    const reviewButtons = document.getElementById('reviewButtons');
    
    frontElement.textContent = currentCard.front;
    backElement.textContent = currentCard.back;
    
    backElement.classList.add('hidden');
    reviewButtons.classList.add('hidden');
    document.getElementById('flipBtn').style.display = 'block';
}

function flipCard() {
    const backElement = document.getElementById('cardBack');
    const reviewButtons = document.getElementById('reviewButtons');
    
    backElement.classList.remove('hidden');
    reviewButtons.classList.remove('hidden');
    document.getElementById('flipBtn').style.display = 'none';
}

function processAnswer(difficulty) {
    const interval = intervals[difficulty][currentCard.level] || intervals[difficulty][intervals[difficulty].length - 1];
    
    currentCard.reviewHistory.push({
        date: new Date(),
        difficulty: difficulty
    });
    
    currentCard.nextReview = new Date();
    currentCard.nextReview.setDate(currentCard.nextReview.getDate() + interval);
    
    if (currentCard.level < intervals[difficulty].length - 1) {
        currentCard.level++;
    }
    
    saveDecksToDisk();
    
    const dueCards = currentDeck.getDueCards();
    if (dueCards.length > 0) {
        currentCard = dueCards[0];
        displayCard();
    } else {
        alert('Review complete!');
        showSection('deckList');
    }
    
    updateStats();
}

function updateStats() {
    const totalCards = decks.reduce((sum, deck) => sum + deck.cards.length, 0);
    const dueToday = decks.reduce((sum, deck) => sum + deck.getDueCards().length, 0);
    const totalReviews = decks.reduce((sum, deck) => 
        sum + deck.cards.reduce((cardSum, card) => cardSum + card.reviewHistory.length, 0), 0);
    
    document.getElementById('dueToday').textContent = dueToday;
    document.getElementById('totalReviewed').textContent = totalReviews;
    
    // Calculate success rate (Good or Easy responses)
    let successfulReviews = 0;
    decks.forEach(deck => {
        deck.cards.forEach(card => {
            successfulReviews += card.reviewHistory.filter(
                review => review.difficulty === 'good' || review.difficulty === 'easy'
            ).length;
        });
    });
    
    const successRate = totalReviews > 0 ? Math.round((successfulReviews / totalReviews) * 100) : 0;
    document.getElementById('successRate').textContent = `${successRate}%`;
    
    // Update chart
    updateReviewChart();
}

function updateReviewChart() {
    const ctx = document.getElementById('reviewChart').getContext('2d');
    const dates = getLast7Days();
    const reviewData = new Array(7).fill(0);
    
    decks.forEach(deck => {
        deck.cards.forEach(card => {
            card.reviewHistory.forEach(review => {
                const reviewDate = new Date(review.date);
                const dayIndex = dates.findIndex(date => 
                    date.toDateString() === reviewDate.toDateString()
                );
                if (dayIndex !== -1) {
                    reviewData[dayIndex]++;
                }
            });
        });
    });
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(date => date.toLocaleDateString()),
            datasets: [{
                label: 'Reviews',
                data: reviewData,
                borderColor: '#4299e1',
                backgroundColor: 'rgba(66, 153, 225, 0.1)',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function getLast7Days() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date);
    }
    return dates;
}

function saveDecksToDisk() {
    localStorage.setItem('flashcards', JSON.stringify(decks));
}

// Initialize the app
initializeApp();
