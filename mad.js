// =========================
// Game Variables
// =========================
let generatingPuzzles = false;
let currentGuesses = 0;

let totalGuesses = 0;

let puzzlesSolved = 0;

let currentStreak = 0;



let bestGuess = Infinity;
let currentPuzzle = 0;
let lastFocusedBox = null;

let puzzles = [];

let streak = 0;
let bestStreak = 0;
let totalSolved = 0;

let hintsUsedCurrent = 0;
let hintsUsedTotal = 0;

let connHintsUsed = 0;
let connHintsUsedTotal = 0;

// =========================
// Start Game
// =========================

window.onload = async function () {

    document
        .getElementById("submitBtn")
        .addEventListener("click", checkAnswers);


    document
        .getElementById("connectionBtn")
        .addEventListener("click", checkConnection);


    let hintBtn = document.getElementById("hintBtn");
    if(hintBtn) hintBtn.addEventListener("click", useHint);

    let resetBtn = document.getElementById("resetBtn");
    if(resetBtn) resetBtn.addEventListener("click", resetPuzzle);

    let connHintBtn = document.getElementById("connHintBtn");
    if(connHintBtn) connHintBtn.addEventListener("click", useConnectionHint);


    buildKeyboard();

    let saved = loadGameState();

    if(saved && Array.isArray(saved.puzzles) && saved.puzzles.length > 0){

        restoreGameState(saved);

    } else {

        document.querySelector(".question").innerHTML = "Loading puzzles...";

        await loadPuzzlesFromAI();

        loadPuzzle();

    }


    document.addEventListener("keydown", function(e){

    if(e.key !== "Enter"){
        return;
    }

    e.preventDefault();

    if(document.activeElement.id === "connectionGuess"){

        checkConnection();

    }
    else{

        checkAnswers();

    }

});

};


// =========================
// Fetch Puzzles from AI
// =========================

async function loadPuzzlesFromAI(){

    try {

        let response = await fetch("/generate-puzzles?count=5");
        let data = await response.json();

        if(Array.isArray(data) && data.length > 0){

            puzzles = data;

        } else {

            throw new Error("Invalid puzzle data");

        }

    } catch (error) {

        console.error("Falling back to default puzzles:", error);

        puzzles = [
            {
                sentence: "I can {hear} you with my {ear}.",
                connection: "hearing"
            },
            {
                sentence: "The {cat} chased the {mouse}.",
                connection: "animals"
            }
        ];

    }

}
async function loadMorePuzzles(){

    if(generatingPuzzles) return;


    generatingPuzzles = true;


    try{

        let response = await fetch("/generate-puzzles?count=5");

        let newPuzzles = await response.json();


        puzzles.push(...newPuzzles);

        saveGameState();


    }
    catch(error){

        console.error(error);

    }


    generatingPuzzles = false;

}


// =========================
// Load Current Puzzle
// =========================

function loadPuzzle(){

    let sentence = puzzles[currentPuzzle].sentence;

    let answers = [];

    sentence = sentence.replace(/\{(.*?)\}/g, function(match, word){

        answers.push(word.toLowerCase());

        let html = `<span class="wordGroup">`;

        for(let i = 0; i < word.length; i++){

            let isFirst = (i === 0);

            html += `<input
                        maxlength="1"
                        class="letterBox"
                        data-first="${isFirst}"
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="none"
                        spellcheck="false"
                        inputmode="none"
                        id="word${answers.length-1}_letter${i}">`;

        }

        html += `</span>`;

        return html;

    });

    puzzles[currentPuzzle].answers = answers;

    document.getElementById("currentDifficulty").textContent =
        "Difficulty: " + puzzles[currentPuzzle].difficulty.toUpperCase();

    document.getElementById("currentDifficulty").className =
        puzzles[currentPuzzle].difficulty.toLowerCase();

    document.querySelector(".question").innerHTML = sentence;

    setupLetterBoxes();

    updateHintTracker();

    updateDifficulty();
   
}

// =========================
// Letter Box Helpers
// =========================

function resetTileColor(box){

    box.classList.remove(
        "correct",
        "wrong",
        "present"
    );

    box.dataset.status = "";

}

function focusNextAvailable(boxes, fromIndex){

    for(let i = fromIndex + 1; i < boxes.length; i++){

        if(!boxes[i].disabled){

            boxes[i].focus();
            return;

        }

    }

}

function focusPrevAvailable(boxes, fromIndex){

    for(let i = fromIndex - 1; i >= 0; i--){

        if(!boxes[i].disabled){

            boxes[i].focus();
            return;

        }

    }

}
function updateActiveBox(){

    document.querySelectorAll(".letterBox").forEach(function(box){

        box.classList.remove("active");

    });

    if(document.activeElement.classList.contains("letterBox")){

        document.activeElement.classList.add("active");

    }

}

function setupLetterBoxes(){

    let boxes = document.querySelectorAll(".letterBox");


    boxes.forEach(function(box,index){


        box.addEventListener("input", function(){


            // Clear message when player starts a new guess
            let message = document.getElementById("messageBox");

            if(message){

                message.innerHTML = "";

            }



            this.value = this.value.replace(/[^a-zA-Z]/g, "");



            if(this.dataset.first === "true"){

                this.value = this.value.toUpperCase();

            } 
            else {

                this.value = this.value.toLowerCase();

            }



            if(this.value === ""){

                resetTileColor(this);

            }



            if(this.value !== ""){

                focusNextAvailable(boxes,index);

            }


            saveGameState();


        });




        box.addEventListener("keydown",function(e){


            if(e.key === "Backspace" &&
               this.value === "" &&
               index > 0){


                focusPrevAvailable(boxes,index);


            }



            if(e.key === "ArrowRight"){

                focusNextAvailable(boxes,index);

            }



            if(e.key === "ArrowLeft"){

                focusPrevAvailable(boxes,index);

            }


        });




box.addEventListener("focus",function(){

    lastFocusedBox = box;

    updateActiveBox();

});



    });




    let firstAvailable = Array.from(boxes)
    .find(box => !box.disabled);



if(firstAvailable){

    firstAvailable.focus();

    updateActiveBox();

}


}

async function checkAnswers() {

    currentGuesses++;

    let allCorrect = true;
    let delay = 0;

    const flipDuration = 600;
    const staggerStep = 300;


    for (let w = 0; w < puzzles[currentPuzzle].answers.length; w++) {


        let answer = puzzles[currentPuzzle].answers[w];

        let guess = "";


        // Build guessed word
        for (let i = 0; i < answer.length; i++) {

            guess += document
                .getElementById(`word${w}_letter${i}`)
                .value
                .toLowerCase();

        }



        // Make sure word is filled
        if(guess.length !== answer.length){

            document.getElementById("statusMessage").textContent =
            "Finish the word first";

            currentGuesses--;

            return;

        }



        // Check real word
        let validWord = await isRealWord(guess);


        if(!validWord){


            let boxes = [];


            for(let i = 0; i < answer.length; i++){

                boxes.push(
                    document.getElementById(
                        `word${w}_letter${i}`
                    )
                );

            }



            boxes.forEach(function(box){


                box.classList.add("shake");


                setTimeout(function(){

                    box.classList.remove("shake");

                },400);


            });



            document.getElementById("statusMessage").textContent =
            `"${guess}" is not a real word`;


            currentGuesses--;

            return;

        }




        let result = new Array(answer.length).fill("wrong");

        let letterPool = {};



        // Count answer letters
        for(let i = 0; i < answer.length; i++){

            let letter = answer[i];

            letterPool[letter] =
            (letterPool[letter] || 0) + 1;

        }




        // Green first
        for(let i = 0; i < answer.length; i++){


            if(guess[i] === answer[i]){


                result[i] = "correct";

                letterPool[guess[i]]--;

            }

        }




        // Yellow second
        for(let i = 0; i < answer.length; i++){


            if(result[i] === "correct") continue;


            let letter = guess[i];


            if(letterPool[letter] > 0){


                result[i] = "present";

                letterPool[letter]--;

            }

        }





        // Apply tile results
        for(let i = 0; i < answer.length; i++){


            let box =
            document.getElementById(
                `word${w}_letter${i}`
            );


            let status = result[i];

            let letter = guess[i];



            box.classList.remove(
                "correct",
                "wrong",
                "present",
                "flip"
            );


            void box.offsetWidth;


            box.style.animationDelay =
            delay + "ms";


            box.classList.add("flip");



            setTimeout(function(){


                box.classList.add(status);

                box.dataset.status = status;



                if(status === "correct"){


                    box.disabled = true;


                }
                else{


                    allCorrect = false;


                }



            }, delay + flipDuration / 2);



            setTimeout(function(){


                updateKeyboardColors(letter);



            }, delay + flipDuration);



            delay += staggerStep;


        }


    }





    setTimeout(function(){


        saveGameState();


        if(allCorrect){


            document.getElementById("connectionBox")
            .style.display = "block";

            resetKeyboardColors();


        }
        else{


            let allBoxes =
            document.querySelectorAll(".letterBox");



            allBoxes.forEach(function(box){


                if(box.disabled) return;


                box.classList.add("shake");


                box.addEventListener(
                    "animationend",
                    function handler(){


                        box.classList.remove("shake");


                        box.removeEventListener(
                            "animationend",
                            handler
                        );


                    }
                );


            });


        }



    }, delay + flipDuration);



}


function connectionsMatch(guess, answer){

    if(guess === answer) return true;

    if(guess + "s" === answer) return true;

    if(answer + "s" === guess) return true;

    return false;

}


function checkConnection(){

    let box = document.getElementById("connectionGuess");

    let guess = box.value
        .trim()
        .toLowerCase();

    box.classList.remove("connectionWrong");
    box.classList.remove("connectionCorrect");

    if(connectionsMatch(guess, puzzles[currentPuzzle].connection)){

    box.classList.add("connectionCorrect");


    // Update stats
    streak++;

    totalSolved++;


    if(streak > bestStreak){

        bestStreak = streak;

    }


    updateStats();



    addPuzzleToHistory(puzzles[currentPuzzle]);

    saveGameState();


    setTimeout(function(){

        nextPuzzle();

    },800);

}
    else{

        box.classList.add("connectionWrong");

    }

}


async function nextPuzzle(){


    currentPuzzle++;

    hintsUsedCurrent = 0;
    updateHintTracker();



    // If we are running low, generate more
    if(currentPuzzle >= puzzles.length - 2){


        loadMorePuzzles();


    }





    document.getElementById("connectionBox")
    .style.display = "none";


    let connBox = document.getElementById("connectionGuess");

    connBox.value = "";
    connBox.classList.remove("connectionCorrect", "connectionWrong");

    let hintDisplay = document.getElementById("connectionHintText");
    if(hintDisplay) hintDisplay.textContent = "";

    connHintsUsed = 0;


    resetKeyboard();
    loadPuzzle();

    saveGameState();


}


function buildKeyboard(){

    const rows = [
        "QWERTYUIOP",
        "ASDFGHJKL",
        "ZXCVBNM"
    ];


    let keyboard = document.getElementById("keyboard");

    keyboard.innerHTML = "";



    rows.forEach(function(rowLetters, rowIndex){


        let row = document.createElement("div");

        row.className = "keyboardRow";



        rowLetters.split("").forEach(function(letter){


            let key = document.createElement("button");

            key.textContent = letter;

            key.className = "key";

            key.id = "key_" + letter;



            key.addEventListener("mousedown", function(e){

                e.preventDefault();

            });



            key.addEventListener("click", function(){

                typeLetter(letter);

            });



            row.appendChild(key);


        });



        // Bottom row buttons
        if(rowIndex === rows.length - 1){



            // ENTER BUTTON

            let enterKey = document.createElement("button");

            enterKey.textContent = "ENTER";

            enterKey.className = "key keyWide";



            enterKey.addEventListener("mousedown", function(e){

                e.preventDefault();

            });



            enterKey.addEventListener("click", function(){


                if(document.activeElement.id === "connectionGuess"){

                    checkConnection();

                }
                else{

                    checkAnswers();

                }


            });



            row.appendChild(enterKey);





            // BACKSPACE BUTTON

            let backspaceKey = document.createElement("button");

            backspaceKey.textContent = "⌫";

            backspaceKey.className = "key keyWide";



            backspaceKey.addEventListener("mousedown", function(e){

                e.preventDefault();

            });



            backspaceKey.addEventListener("click", function(){

                typeBackspace();

            });



            row.appendChild(backspaceKey);


        }



        keyboard.appendChild(row);


    });


}

function typeLetter(letter){

    if(lastFocusedBox && !lastFocusedBox.disabled){

        lastFocusedBox.value = letter;

        lastFocusedBox.dispatchEvent(new Event("input"));

    }

}
function typeBackspace(){

    if(!lastFocusedBox) return;


    let boxes = Array.from(
        document.querySelectorAll(".letterBox")
    );


    let index = boxes.indexOf(lastFocusedBox);



    function clearWrongOnly(box){

        if(box.classList.contains("wrong")){

            box.classList.remove("wrong");

            box.dataset.status = "";

        }

    }



    if(lastFocusedBox.value !== "" &&
       !lastFocusedBox.disabled){


        lastFocusedBox.value = "";


        // Remove only gray
        clearWrongOnly(lastFocusedBox);


        refreshKeyboard();

        saveGameState();


        return;

    }




    for(let i = index - 1; i >= 0; i--){


        if(!boxes[i].disabled){


            boxes[i].focus();


            boxes[i].value = "";


            // Remove only gray
            clearWrongOnly(boxes[i]);


            lastFocusedBox = boxes[i];


            refreshKeyboard();

            saveGameState();


            break;


        }


    }

}



function refreshKeyboard(){


    let keyboardState = {};



    document.querySelectorAll(".letterBox")
    .forEach(function(box){


        let letter = box.value.toLowerCase();


        if(letter === "") return;



        let status = box.dataset.status;



        if(!status) return;



        if(
            !keyboardState[letter] ||
            status === "correct" ||
            (status === "present" && keyboardState[letter] === "wrong")
        ){

            keyboardState[letter] = status;

        }


    });





    for(let letter in keyboardState){


        let key =
        document.getElementById(
            "key_" + letter.toUpperCase()
        );


        if(!key) continue;



        key.classList.remove(
            "correct",
            "present",
            "wrong"
        );



        key.classList.add(
            keyboardState[letter]
        );


    }


}


function resetKeyboardColors(){

    let keys = document.querySelectorAll(".key");

    keys.forEach(function(key){

        key.classList.remove("correct", "present", "wrong");

    });

}


function addPuzzleToHistory(puzzle, guesses){


    let filledSentence =
    puzzle.sentence.replace(/\{(.*?)\}/g,function(match,word){

        return `<span class="filledWord">${word}</span>`;

    });



    let difficulty =
    puzzle.difficulty || "medium";



    let entry = document.createElement("div");


    entry.className =
    "historyEntry " +
    getDifficultyClass(difficulty);




    entry.innerHTML = `


        <div class="difficultyLabel">

            ${difficulty.toUpperCase()}

        </div>


        <div class="historySentence">

            ${filledSentence}

        </div>


        <div class="guessCount">

            🎯 Solved in ${guesses} guesses

        </div>


        <div class="historyConnection">

            🔗 Connection: ${puzzle.connection}

        </div>


    `;



    document
    .getElementById("historyList")
    .prepend(entry);



    currentGuesses = 0;


}
async function isRealWord(word){

    try{

        let response = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
        );

        if(response.ok) return true;

        // If that failed, try the singular form (strip trailing "s")
        if(word.endsWith("s") && word.length > 3){

            let singular = word.slice(0, -1);

            let singularResponse = await fetch(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${singular}`
            );

            if(singularResponse.ok) return true;

        }

        return false;

    }catch(error){

        console.error("Dictionary error:", error);

        return false;

    }

}


// =========================
// Stats (single merged version — updates both #statsBox and #messageBox)
// =========================

function updateStats(){

    let stats = document.getElementById("statsBox");

    if(stats){

        let average =
            puzzlesSolved === 0
            ? 0
            : (totalGuesses / puzzlesSolved).toFixed(1);

        stats.innerHTML = `

🔥 Streak: <span class="statValue">${streak}</span>

🏆 Best: <span class="statValue">${bestStreak}</span>

🧩 Solved: <span class="statValue">${totalSolved}</span>

🎯 Avg Guesses: <span class="statValue">${average}</span>

⚡ Best Solve: <span class="statValue">${bestGuess === Infinity ? "-" : bestGuess}</span>

`;

    }

    let message = document.getElementById("messageBox");

    if(message){

        message.innerHTML = `Solved: ${totalSolved} • Current streak: ${streak}`;

    }

}


function resetKeyboard(){

    let keys = document.querySelectorAll(".key");


    keys.forEach(function(key){

        key.classList.remove(
            "correct",
            "present",
            "wrong"
        );

    });

}
function getDifficultyClass(difficulty){

    if(difficulty === "easy"){

        return "easyDifficulty";

    }


    if(difficulty === "medium"){

        return "mediumDifficulty";

    }


    if(difficulty === "hard"){

        return "hardDifficulty";

    }


    if(difficulty === "expert"){

        return "expertDifficulty";

    }


    return "mediumDifficulty";

}


// =========================
// Persistence (localStorage)
// =========================

function saveGameState(){

    try{

        let boxStates = [];

        document.querySelectorAll(".letterBox").forEach(function(box){

            boxStates.push({
                id: box.id,
                value: box.value,
                status: box.dataset.status || "",
                disabled: box.disabled
            });

        });

        let state = {
            puzzles: puzzles,
            currentPuzzle: currentPuzzle,
            currentGuesses: currentGuesses,
            streak: streak,
            bestStreak: bestStreak,
            totalSolved: totalSolved,
            hintsUsedCurrent: hintsUsedCurrent,
            hintsUsedTotal: hintsUsedTotal,
            connHintsUsed: connHintsUsed,
            connHintsUsedTotal: connHintsUsedTotal,
            boxStates: boxStates,
            connectionBoxVisible:
                document.getElementById("connectionBox").style.display === "block",
            historyHTML: document.getElementById("historyList").innerHTML
        };

        localStorage.setItem("madConexState", JSON.stringify(state));

    }catch(error){

        console.error("Failed to save game state:", error);

    }

}

function loadGameState(){

    let raw = localStorage.getItem("madConexState");

    if(!raw) return null;

    try{

        return JSON.parse(raw);

    }catch(error){

        console.error("Failed to parse saved state:", error);

        return null;

    }

}

function restoreGameState(state){

    puzzles = state.puzzles;
    currentPuzzle = state.currentPuzzle;
    currentGuesses = state.currentGuesses || 0;
    streak = state.streak || 0;
    bestStreak = state.bestStreak || 0;
    totalSolved = state.totalSolved || 0;
    hintsUsedCurrent = state.hintsUsedCurrent || 0;
    hintsUsedTotal = state.hintsUsedTotal || 0;
    connHintsUsed = state.connHintsUsed || 0;
    connHintsUsedTotal = state.connHintsUsedTotal || 0;

    loadPuzzle();

    (state.boxStates || []).forEach(function(saved){

        let box = document.getElementById(saved.id);

        if(!box) return;

        box.value = saved.value;
        box.disabled = saved.disabled;

        if(saved.status){

            box.classList.add(saved.status);
            box.dataset.status = saved.status;

        }

    });

    refreshKeyboard();

    if(state.connectionBoxVisible){

        document.getElementById("connectionBox").style.display = "block";

        resetKeyboardColors();

    }

    if(state.historyHTML){

        document.getElementById("historyList").innerHTML = state.historyHTML;

    }

    updateStats();
    updateHintTracker();

}


// =========================
// Reset Puzzle
// =========================

function resetPuzzle(){

    let boxes = document.querySelectorAll(".letterBox");

    boxes.forEach(function(box){

        box.value = "";
        box.disabled = false;
        resetTileColor(box);

    });

    currentGuesses = 0;
    hintsUsedCurrent = 0;
    connHintsUsed = 0;

    document.getElementById("connectionBox").style.display = "none";

    let connBox = document.getElementById("connectionGuess");
    connBox.value = "";
    connBox.classList.remove("connectionCorrect", "connectionWrong");

    let connHint = document.getElementById("connectionHintText");
    if(connHint) connHint.textContent = "";

    document.getElementById("statusMessage").textContent = "";

    resetKeyboard();
    updateHintTracker();

    let first = document.querySelector(".letterBox");

    if(first) first.focus();

    saveGameState();

}


// =========================
// Word Hints
// =========================

function revealBoxAnswer(box){

    let match = box.id.match(/word(\d+)_letter(\d+)/);

    if(!match) return;

    let w = Number(match[1]);
    let i = Number(match[2]);

    let answer = puzzles[currentPuzzle].answers[w];
    let letter = answer[i];

    box.value = box.dataset.first === "true" ? letter.toUpperCase() : letter;

    box.classList.remove("correct", "wrong", "present");
    box.classList.add("correct");
    box.dataset.status = "correct";
    box.disabled = true;

}

function useHint(){

    let boxes = Array.from(document.querySelectorAll(".letterBox"));
    let unsolved = boxes.filter(box => !box.disabled);

    if(unsolved.length === 0) return;

    hintsUsedCurrent++;
    hintsUsedTotal++;

    if(hintsUsedCurrent < 4){

        let randomBox = unsolved[Math.floor(Math.random() * unsolved.length)];

        revealBoxAnswer(randomBox);

    } else {

        unsolved.forEach(revealBoxAnswer);

    }

    refreshKeyboard();
    updateHintTracker();

    let allBoxes = document.querySelectorAll(".letterBox");
    let allSolved = Array.from(allBoxes).every(box => box.disabled);

    if(allSolved){

        document.getElementById("connectionBox").style.display = "block";

        resetKeyboardColors();

    }

    saveGameState();

}

function updateHintTracker(){

    let tracker = document.getElementById("hintTracker");

    if(!tracker) return;

    tracker.innerHTML =
        `💡 Hints: ${hintsUsedCurrent}/4 this puzzle • ${hintsUsedTotal} all-time`;

}


// =========================
// Connection Hints
// =========================

function useConnectionHint(){

    let answer = puzzles[currentPuzzle].connection;
    let hintDisplay = document.getElementById("connectionHintText");

    connHintsUsed++;
    connHintsUsedTotal++;

    if(connHintsUsed >= 4){

        document.getElementById("connectionGuess").value = answer;

        if(hintDisplay){

            hintDisplay.textContent = answer.toUpperCase();

        }

    } else {

        let revealed = answer.slice(0, connHintsUsed);
        let hidden = "_ ".repeat(answer.length - connHintsUsed).trim();

        if(hintDisplay){

            hintDisplay.textContent =
                revealed.toUpperCase().split("").join(" ") +
                (hidden ? " " + hidden : "");

        }

    }

    saveGameState();

}
function updateDifficulty(){

    const label =
    document.getElementById("difficultyLabel");

    if(!label) return;

    label.className = "";

    const difficulty =
    puzzles[currentPuzzle].difficulty.toLowerCase();

    label.classList.add(difficulty);

    label.textContent =
        difficulty.toUpperCase();

}
const historyToggle = document.getElementById("historyToggle");
const historyList = document.getElementById("historyList");

historyToggle.addEventListener("click", function(){

    const open = historyList.style.display === "flex";

    if(open){

        historyList.style.display = "none";
        historyToggle.innerHTML =
            `📚 Solved Puzzles (${history.length}) ▼`;

    }else{

        historyList.style.display = "flex";
        historyToggle.innerHTML =
            `📚 Solved Puzzles (${history.length}) ▲`;

    }
    

historyToggle.innerHTML =
    `📚 Solved Puzzles (${history.length}) ▼`;

});