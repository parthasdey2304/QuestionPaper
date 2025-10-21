const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Teacher = require('../models/Teacher');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_secret';

function auth(req, res, next){
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Unauthorized' });
  const token = header.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// check if all 5 teachers have submitted
router.get('/can-generate', auth, async (req, res) => {
  const teachers = await Teacher.find({});
  if (teachers.length < 5) return res.json({ canGenerate: false, reason: 'Less than 5 teachers registered' });
  const all = teachers.every(t => t.hasSubmitted);
  res.json({ canGenerate: all });
});

// generate paper (simple greedy selection to match format)
router.get('/generate', auth, async (req, res) => {
  const teachers = await Teacher.find({});
  if (teachers.length < 5) return res.status(400).json({ message: 'Need 5 teachers registered' });
  const allSubmitted = teachers.every(t => t.hasSubmitted);
  if (!allSubmitted) return res.status(400).json({ message: 'All teachers must submit first' });

  const allQuestions = await Question.find({});
  // Helper function to get random items from an array
function getRandomItems(arr, count) {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Separate questions by marks
const twoMarkQs = allQuestions.filter(q => q.marks === 2);
const fiveMarkQs = allQuestions.filter(q => q.marks === 5);

// --- SECTION A: 10 random 2-mark questions ---
const sectionA = getRandomItems(twoMarkQs, 10);

// --- SECTION B: 3 questions (each 5+3+2 marks) ---
const sectionB = [];

const threeMarkQs = allQuestions.filter(q => q.marks === 3);
const usedFivesB = getRandomItems(fiveMarkQs, 3);  // 3 five-mark questions
const usedThreesB = getRandomItems(threeMarkQs, 3); // 3 three-mark questions
const remainingTwos = twoMarkQs.filter(q => !sectionA.includes(q));
const usedTwosB = getRandomItems(remainingTwos, 3); // 3 two-mark questions

for (let i = 0; i < 3; i++) {
  const group = [
    usedFivesB[i],
    usedThreesB[i],
    usedTwosB[i]
  ].filter(Boolean);
  if (group.length === 3) sectionB.push(group);
}


// --- SECTION C: 3 questions (each 5+5 marks) ---
const remainingFives = fiveMarkQs.filter(q => !usedFivesB.includes(q));
const usedFivesC = getRandomItems(remainingFives, 6); // need 6 five-mark qs
const sectionC = [];
for (let i = 0; i < 3; i++) {
  const group = [usedFivesC[i * 2], usedFivesC[i * 2 + 1]].filter(Boolean);
  if (group.length === 2) sectionC.push(group);
}


  // Build a simple HTML view
  let html = '<!doctype html><html><head><meta charset="utf-8"><title>Question Paper</title></head><body>';
  html += '<h2>SECTION A (20 marks) - 10 questions x 2 marks</h2><ol>';
  sectionA.forEach(q=> html += `<li>${q.questionText} <strong>(${q.marks}m)</strong></li>`);
  html += '</ol>';
  html += '<h2>SECTION B (30 marks) - 3 questions (5+3+2 each)</h2><ol>';
  sectionB.forEach((grp, idx)=> {
    html += `<li>Q${idx+1}:<ul>`;
    grp.forEach(g=> html += `<li>${g.questionText} (${g.marks}m)</li>`);
    html += '</ul></li>';
  });
  html += '</ol>';
  html += '<h2>SECTION C (30 marks) - 3 questions (5+5 each)</h2><ol>';
  sectionC.forEach((grp, idx)=> {
    html += `<li>Q${idx+1}:<ul>`;
    grp.forEach(g=> html += `<li>${g.questionText} (${g.marks}m)</li>`);
    html += '</ul></li>';
  });
  html += '</ol></body></html>';
  res.send(html);
});

module.exports = router;