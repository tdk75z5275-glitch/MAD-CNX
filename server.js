require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(cors({
    origin: "https://mad-conex.vercel.app"
}));

app.use(express.static(path.join(__dirname)));


let cachedPuzzles = null;


// =========================
// Puzzle Memory (persists across restarts)
// =========================

const MEMORY_FILE = path.join(__dirname, "puzzleMemory.json");

let puzzleMemory = {
    connections: [],
    sentences: []
};

if(fs.existsSync(MEMORY_FILE)){

    try{

        puzzleMemory = JSON.parse(fs.readFileSync(MEMORY_FILE));

    }
    catch(error){

        console.error("Failed to read puzzleMemory.json, starting fresh:", error);

    }

}

function saveMemory(){

    fs.writeFileSync(
        MEMORY_FILE,
        JSON.stringify(puzzleMemory, null, 2)
    );

}



app.get("/generate-puzzles", async function(req,res){


    const forceNew = req.query.new === "true";

    const count = Number(req.query.count) || 5;



    if(cachedPuzzles && !forceNew){

        console.log("Serving cached puzzles");

        return res.json(cachedPuzzles);

    }


    // Only send the AI the most recent memory so the prompt doesn't grow forever
    const recentConnections = puzzleMemory.connections.slice(-60);
    const recentSentences = puzzleMemory.sentences.slice(-30);



    const prompt = `Generate ${count} unique puzzles for a game called Mad-Conex.


Mad-Conex is a combination of:

- Wordle
- Connections
- Mad Libs


The player guesses hidden words inside a sentence.

After solving the words, they must discover the connection.



FORMAT:


[
{
"sentence":"The {word} goes with the {word} near the {word} during the {word}.",
"connection":"category",
"difficulty":"easy"
}
]



PUZZLE REQUIREMENTS:

Every puzzle must have:

- Exactly 4 hidden words
- Exactly 1 connection
- Exactly 1 difficulty



HIDDEN WORD RULES:

Hidden words must:

- Be real English dictionary words
- Be lowercase
- Have no punctuation
- Be common enough for players to know
- Fit naturally in the sentence
- Be singular (not plural)


NEVER USE:

- Names
- People
- Cities
- Countries
- Brands
- Companies
- Movies
- TV shows
- Famous characters
- Planets
- Proper nouns
-Profanity


Bad examples:

{Jupiter}
{Nike}
{Paris}
{Einstein}


Good examples:

{tree}
{river}
{guitar}
{snow}
{hammer}



CONNECTION RULES:

The connection must:

- Be exactly ONE lowercase word
- Be singular
- Not be one of the hidden words
- Connect all four answers


Avoid boring connections.

Do not always use:

animal
food
planet
object



PUZZLE STYLES:

Randomly mix:


Category:

dog, cat, horse, lion

connection:
animal


Shared property:

gold, silver, copper, iron

connection:
metal


Object relationship:

key, lock, door, handle

connection:
access


Action relationship:

jump, run, sprint, race

connection:
movement


Indirect relationship:

moon, wave, ocean, tide

connection:
gravity


Word relationship:

bat, glove, diamond, pitch

connection:
baseball


Historical relationship:

castle, knight, sword, armor

connection:
medieval



USE MANY DIFFERENT AREAS:


Animals
Plants
Nature
Weather
Ocean
Space concepts
Sports
Games
Video games
Board games
Music
Instruments
Art
Colors
Shapes
Science
Physics
Chemistry
Biology
Human body
Emotions
Psychology
Careers
Tools
Technology
Programming
Internet
Transportation
Vehicles
Architecture
Travel
Culture
Languages
Writing
Books
Fantasy
Random objects
Mythology
Engineering
Medicine
Farming
Construction
Photography
Fashion
Dance
Theater
Camping
Fishing
Astronomy
Geology



DO NOT:

- Repeat themes
- Make mostly kitchen puzzles
- Make mostly household puzzles
- Use obvious AI examples
- Make impossible connections



Generate 5 Mad-CNX puzzles.

Each puzzle MUST contain:
- exactly four hidden words
- exactly one-word connection
- one complete sentence
- natural English

Difficulty Guide

EASY
- Common everyday words.
- Obvious category.
- Most players solve in under 3 minutes.

MEDIUM
- Mostly common words.
- One uncommon word allowed.
- Requires some deduction.
- The category should not be obvious immediately.

HARD
- At least two uncommon or technical words.
- Multiple categories should seem plausible.
- The sentence must not reveal the category.
- Solvable only after finding most of the words.

EXPERT
- Specialized vocabulary.
- The four words belong to a very narrow topic.
- The connection should require expert knowledge.
- Avoid obvious clue words.

After generating each puzzle, evaluate whether it truly matches the requested difficulty.
If it is too easy or too hard, rewrite it until it fits.
Never mislabel the difficulty.

Return ONLY valid JSON.
------------------------------------

VERY IMPORTANT

Never accidentally reveal the connection.

For example, if the connection is "knitting", the sentence must NOT contain words like:

knit
sew
fabric
crochet

unless they are one of the four hidden words.

Likewise:

Connection = astronomy
Do NOT use "planet", "space", or "galaxy" outside the hidden words.

Connection = cybersecurity
Do NOT use "computer", "hack", or "internet" outside the hidden words.

------------------------------------

SELF-CHECK

Before returning each puzzle, ask yourself:

1. Does it really match the requested difficulty?
2. Would a human agree with this rating?
3. Is the category accidentally obvious?
4. Are all four words necessary?
5. Could this puzzle be made better?

If not, rewrite it.

Return ONLY the final JSON.


ANTI-REPETITION — CRITICAL:

These connections were already used recently. Do NOT reuse any of them:

${recentConnections.length > 0 ? recentConnections.join(", ") : "(none yet)"}


These sentence patterns/themes were already used. Do NOT create anything similar in vocabulary, subject matter, or style:

${recentSentences.length > 0 ? recentSentences.join("\n") : "(none yet)"}


Every puzzle must feel meaningfully different from the list above.



QUALITY CHECK:

Before returning:

Reject puzzles that:

- Have duplicate themes
- Have duplicate connections
- Have multiple possible answers
- Are too obvious
- Are impossible
- Use banned words


Return ONLY JSON.

No markdown.
No explanations.
No backticks.`;




    try{


        const response = await fetch(

            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,

            {

                method:"POST",

                headers:{
                    "Content-Type":"application/json"
                },


                body:JSON.stringify({

                    contents:[
                        {
                            parts:[
                                {
                                    text:prompt
                                }
                            ]
                        }
                    ]

                })

            }

        );




        const data = await response.json();



        console.log(
            "Gemini raw response:",
            JSON.stringify(data,null,2)
        );




        let text =
        data.candidates[0]
        .content
        .parts[0]
        .text;




        text = text
        .replace(/```json/g,"")
        .replace(/```/g,"")
        .trim();




        let puzzles = JSON.parse(text);




        const bannedWords = [

            "jupiter",
            "venus",
            "mars",
            "mercury",
            "earth",
            "saturn",
            "nike",
            "paris",
            "einstein"

        ];



        let usedConnections = [];



        puzzles = puzzles.filter(function(puzzle){



            if(!puzzle.sentence ||
               !puzzle.connection ||
               !puzzle.difficulty){

                return false;

            }




            let sentence =
            puzzle.sentence.toLowerCase();




            for(let word of bannedWords){

                if(sentence.includes(`{${word}}`)){

                    return false;

                }

            }




            let answers =
            puzzle.sentence.match(/\{(.*?)\}/g);



            if(!answers || answers.length !== 4){

                return false;

            }





            if(
                ![
                    "easy",
                    "medium",
                    "hard",
                    "expert"

                ].includes(
                    puzzle.difficulty
                )
            ){

                return false;

            }





            if(
                usedConnections.includes(
                    puzzle.connection
                )
            ){

                return false;

            }


            // Also reject if it repeats something from recent memory
            if(
                recentConnections.includes(
                    puzzle.connection
                )
            ){

                return false;

            }



            usedConnections.push(
                puzzle.connection
            );



            return true;



        });


        // Save what we used so future generations avoid repeating it
        puzzles.forEach(function(puzzle){

            puzzleMemory.connections.push(puzzle.connection);
            puzzleMemory.sentences.push(puzzle.sentence);

        });

        // Keep memory from growing forever
        puzzleMemory.connections = puzzleMemory.connections.slice(-300);
        puzzleMemory.sentences = puzzleMemory.sentences.slice(-150);

        saveMemory();




        cachedPuzzles = puzzles;



        res.json(puzzles);



    }
    catch(error){


        console.error(
            "AI generation failed:",
            error
        );


        res.status(500).json({

            error:"Failed to generate puzzles"

        });


    }



});





app.listen(PORT,function(){


    console.log(
        `Mad-Conex server running at http://localhost:${PORT}`
    );


});