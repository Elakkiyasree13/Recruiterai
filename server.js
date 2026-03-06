import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mammoth from 'mammoth';
import fs from 'fs';
import { createRequire } from 'module';
import nlp from 'compromise';

const require = createRequire(import.meta.url);
let pdfParse;
try {
    const pdf = require('pdf-parse');
    pdfParse = typeof pdf === 'function' ? pdf : pdf.default;
} catch (e) {
    console.error("[CRITICAL] Failed to load pdf-parse:", e);
}

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Predefined company-required skills with Aliases for better matching
const REQUIRED_SKILLS_MAP = {
    "Python": ["python", "py", "python3", "django", "flask", "pandas", "numpy"],
    "Machine Learning": ["machine learning", "ml", "deep learning", "neural networks", "ai", "artificial intelligence", "tensorflow", "pytorch", "scikit-learn"],
    "SQL": ["sql", "mysql", "postgresql", "postgres", "nosql", "mongodb", "database", "rdbms"],
    "Communication": ["communication", "writing", "verbal", "presentation", "interpersonal", "soft skills", "collaboration"],
    "Java": ["java", "spring", "springboot", "hibernate", "maven", "jdk"],
    "React": ["react", "react.js", "reactjs", "next.js", "nextjs", "jsx", "redux", "frontend"],
    "Docker": ["docker", "containerization", "kubernetes", "k8s", "devops"],
    "Agile": ["agile", "scrum", "kanban", "sprints", "jira", "project management"],
    "AWS": ["aws", "amazon web services", "cloud", "s3", "ec2", "lambda", "azure", "gcp"],
    "Data Analysis": ["data analysis", "analytics", "visualization", "power bi", "tableau", "excel", "statistics"]
};

const REQUIRED_SKILLS = Object.keys(REQUIRED_SKILLS_MAP);

// AI Question Bank for Skills
const QUESTION_BANK = {
    "Python": [
        { q: "What is the result of 3 * '3' in Python?", options: ["9", "'333'", "Error", "27"], a: "'333'" },
        { q: "Which keyword is used to create a function in Python?", options: ["func", "define", "def", "function"], a: "def" },
        { q: "What is a list in Python?", options: ["Sorted array", "Ordered collection", "Unique set", "Function object"], a: "Ordered collection" },
        { q: "Which of these is used for slicing a list 'L' from index 1 to 5?", options: ["L(1:5)", "L[1:5]", "L{1..5}", "L.slice(1,5)"], a: "L[1:5]" },
        { q: "Which data type is immutable in Python?", options: ["List", "Set", "Tuple", "Dict"], a: "Tuple" }
    ],
    "SQL": [
        { q: "Which command is used to remove all records from a table?", options: ["DELETE", "TRUNCATE", "DROP", "REMOVE"], a: "TRUNCATE" },
        { q: "What does SQL stand for?", options: ["Simple Query Language", "Structured Query Language", "System Quick Logic", "Standard Query Link"], a: "Structured Query Language" },
        { q: "Which operator is used to search for a specified pattern in a column?", options: ["GET", "MATCH", "LIKE", "SEARCH"], a: "LIKE" },
        { q: "Which SQL statement is used to delete a record?", options: ["REMOVE FROM", "DELETE FROM", "DELETE IN", "WIPE"], a: "DELETE FROM" },
        { q: "What is the default sort order for ORDER BY?", options: ["DESC", "ASC", "Random", "None"], a: "ASC" }
    ],
    "Machine Learning": [
        { q: "What is 'Supervised Learning'?", options: ["Learning with humans", "Learning with labeled data", "Learning with rewards", "Learning without data"], a: "Learning with labeled data" },
        { q: "Which algorithm is used for binary classification?", options: ["Linear Regression", "K-Means", "Logistic Regression", "Apriori"], a: "Logistic Regression" },
        { q: "What is Overfitting?", options: ["High Training accuracy, High Testing accuracy", "High Training accuracy, Low Testing accuracy", "Low Training accuracy, Low Testing accuracy", "Low Training accuracy, High Testing accuracy"], a: "High Training accuracy, Low Testing accuracy" },
        { q: "Which library is most common for Deep Learning?", options: ["Pandas", "PyTorch", "NumPy", "Matplotlib"], a: "PyTorch" },
        { q: "What is a 'Neuron' in ML context?", options: ["Biological cell", "Processing unit", "Data point", "Variable"], a: "Processing unit" }
    ],
    "React": [
        { q: "What is the Virtual DOM?", options: ["Real browser DOM", "Memory representation of DOM", "A physical node", "Browser extension"], a: "Memory representation of DOM" },
        { q: "Which hook is used for side effects?", options: ["useState", "useMemo", "useEffect", "useRef"], a: "useEffect" },
        { q: "How do you pass data between parent and child?", options: ["Global variables", "Props", "Direct access", "Events"], a: "Props" },
        { q: "Which command starts a development server?", options: ["npm run build", "npm start", "npm build", "node app.js"], a: "npm start" },
        { q: "What is JSX?", options: ["JavaScript Extension", "Java Syntax", "JSON Style", "CSS Syntax"], a: "JavaScript Extension" }
    ],
    "Agile": [
        { q: "What are 'Sprints' in Agile?", options: ["Fast coding", "Short development cycles", "Morning exercises", "Team meetings"], a: "Short development cycles" },
        { q: "Who facilitates a Scrum meeting?", options: ["Product Owner", "Scrum Master", "CEO", "Developer"], a: "Scrum Master" },
        { q: "What is a 'Product Backlog'?", options: ["Sorted todo list", "History of errors", "Employee list", "Budget report"], a: "Sorted todo list" },
        { q: "What does 'Daily Standup' promote?", options: ["Fitness", "Transparency & Sync", "Argument", "Long discussions"], a: "Transparency & Sync" }
    ],
    "Communication": [
        { q: "What is 'Active Listening'?", options: ["Hearing noise", "Understanding and responding", "Ignoring the speaker", "Writing notes only"], a: "Understanding and responding" },
        { q: "Which is a component of emotional intelligence?", options: ["IQ", "Self-awareness", "Typing speed", "Job title"], a: "Self-awareness" }
    ]
};

// Generic fallback questions
const GENERAL_QUESTIONS = [
    { q: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Tech Machine Language", "Home Tool Markup Link", "Hyperlink Text Mode"], a: "Hyper Text Markup Language" },
    { q: "Which of these is a Cloud provider?", options: ["AWS", "Windows 95", "Photoshop", "Notepad"], a: "AWS" },
    { q: "What is 'Version Control'?", options: ["Controlling computer speed", "Managing code history", "Checking internet version", "Writing code fast"], a: "Managing code history" },
    { q: "What is an 'Algorithm'?", options: ["Programming language", "Set of instructions", "Physical hardware", "Internet cable"], a: "Set of instructions" },
    { q: "Which of these is used for Styling web pages?", options: ["Python", "CSS", "SQL", "Java"], a: "CSS" }
];

const SKILL_TAXONOMY = {
    "JavaScript": ["js", "javascript", "es6", "typescript", "node", "express", "npm", "yarn", "vue", "angular", "svelte"],
    "Web Design": ["html", "css", "tailwind", "sass", "ui/ux", "figma", "bootstrap", "responsive design", "web development"],
    "Version Control": ["git", "github", "gitlab", "bitbucket", "version control", "svn", "mercurial"],
    "Languages": ["c++", "c#", "go", "rust", "php", "ruby", "swift", "kotlin", "c language", "dart", "scala", "clojure"],
    "Backend": ["rest api", "graphql", "microservices", "serverless", "redis", "nginx", "apache", "postman", "swagger"],
    "Soft Skills": ["leadership", "teamwork", "problem solving", "critical thinking", "adaptability", "mentoring", "time management"],
    "Tools": ["office", "excel", "powerpoint", "word", "trello", "slack", "zoom", "teams", "jira", "confluence", "notion"],
    "Mobile": ["react native", "flutter", "ios", "android", "swiftui", "xcode", "mobile development"],
    "Database": ["mongodb", "firebase", "cassandra", "sqlight", "oracle", "neo4j", "elasticsearch"]
};

const ALL_SKILLS_MAP = { ...REQUIRED_SKILLS_MAP, ...SKILL_TAXONOMY };

const extractTextFromPDF = async (filePath) => {
    try {
        if (!pdfParse) return "ERROR: PDF Parser Library not loaded";
        const dataBuffer = fs.readFileSync(filePath);
        console.log(`[DEBUG] Attempting PDF parse on ${dataBuffer.length} bytes`);
        const data = await pdfParse(dataBuffer);
        let text = data.text || "";

        if (text.trim().length < 50) {
            console.warn("[WARN] PDF text extraction returned extremely small amount of text.");
            if (text.trim().length === 0) return "IMAGE_OR_EMPTY_PDF_DETECTED";
        }

        console.log(`[DEBUG] Successfully extracted ${text.length} chars`);
        return text;
    } catch (error) {
        console.error("[ERROR] PDF Parser exception:", error);
        return "PARSER_ERROR: " + (error.message || "Unknown PDF error");
    }
};

const extractTextFromDOCX = async (filePath) => {
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    } catch (error) {
        console.error("[ERROR] DOCX extraction failed:", error);
        return "ERROR_READING_DOCX";
    }
};

/**
 * Enhanced NLP Analysis with Project Fallback
 */
function analyzeResumeContent(text, jobTitle = '') {
    const doc = nlp(text);
    const textLower = text.toLowerCase();
    const jobTitleLower = (jobTitle || '').toLowerCase();
    const extractedSkills = [];

    console.log(`[DEBUG] NLP processing resume (${text.length} chars) with JobTitle: ${jobTitle}`);

    // 1. Skill Extraction
    Object.entries(ALL_SKILLS_MAP).forEach(([skillName, aliases]) => {
        let totalCount = 0;
        aliases.forEach(alias => {
            const aliasLower = alias.toLowerCase();
            const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?<=^|[^a-zA-Z0-9])(${escaped})(?=[^a-zA-Z0-9]|$)`, 'gi');
            const matches = text.match(regex);

            if (matches) {
                totalCount += matches.length;
            } else if (textLower.includes(aliasLower)) {
                totalCount += 1;
            }
        });

        if (totalCount > 0) {
            let jobTitleMatch = false;
            aliases.forEach(alias => {
                if (jobTitleLower.includes(alias.toLowerCase())) jobTitleMatch = true;
            });

            let score = 50 + (totalCount * 10);
            if (jobTitleMatch) score += 25; // Significant boost for domain relevance

            if (score > 100) score = 100;
            extractedSkills.push({
                name: skillName,
                mentions: totalCount,
                percentage: score,
                level: score >= 85 ? 'high' : score >= 65 ? 'medium' : 'low'
            });
        }
    });

    // 2. Project Detection
    const projects = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 20);
    lines.forEach(line => {
        if (line.match(/^[\-\•\*]/) ||
            line.toLowerCase().includes("developed") ||
            line.toLowerCase().includes("implemented") ||
            line.toLowerCase().includes("built") ||
            line.toLowerCase().includes("created")) {
            if (projects.length < 5) projects.push(line.replace(/^[\-\•\*]\s*/, ''));
        }
    });

    // Detect Experience Level
    const yearsMatches = text.match(/(\d+)\+?\s*years?\b/gi);
    let estimatedYears = 0;
    if (yearsMatches) {
        const years = yearsMatches.map(m => parseInt(m.match(/\d+/)[0]));
        estimatedYears = Math.max(...years);
    }
    const careerLevel = estimatedYears >= 8 ? "Senior" : estimatedYears >= 3 ? "Intermediate" : "Junior";

    // Detect Strengths
    const strengths = extractedSkills
        .sort((a, b) => b.mentions - a.mentions)
        .slice(0, 3)
        .map(s => s.name);

    if (strengths.length === 0 && projects.length > 0) {
        strengths.push("Hands-on Project Experience");
    }

    const topics = doc.topics().out('array').slice(0, 5).join(', ');
    const profileSummary = strengths.length > 0
        ? `Candidate profile highlights proficiency in ${strengths.join(' and ')}. Focus areas: ${topics || "Industry Domain"}. Estimated Level: ${careerLevel}.`
        : `Candidate profile shows focus on ${projects.length} key projects. Areas: ${topics || "General Domain Knowledge"}. Level: ${careerLevel}.`;

    return {
        extractedSkills,
        careerLevel,
        strengths,
        profileSummary,
        estimatedYears,
        projects: projects.slice(0, 4)
    };
}

app.post('/api/analyze-resume', upload.single('resume'), async (req, res) => {
    console.log(`[INFO] Analysis request: ${req.file?.originalname}`);
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        let text = '';
        const path = req.file.path;
        const name = req.file.originalname.toLowerCase();

        if (name.endsWith('.pdf')) text = await extractTextFromPDF(path);
        else if (name.endsWith('.docx')) text = await extractTextFromDOCX(path);
        else return res.status(400).json({ error: 'Unsupported format' });

        if (fs.existsSync(path)) fs.unlinkSync(path);

        if (text === "IMAGE_OR_EMPTY_PDF_DETECTED" || text === "ERROR: PDF Parser Library not loaded" || text.trim().length <= 5) {
            return res.json({
                overallMatchPercentage: 0,
                matchedSkills: [],
                missingSkills: REQUIRED_SKILLS.map(s => ({ name: s, percentage: 0, level: 'none' })),
                extractedSkills: [],
                profileSummary: "Extraction failed. Document may be a scanned image or unreadable PDF.",
                careerLevel: "N/A",
                strengths: [],
                requiredSkillsCount: REQUIRED_SKILLS.length,
                unreadable: true,
                debugRawText: "0 contents showed"
            });
        }

        const analysis = analyzeResumeContent(text, req.body.jobTitle);

        const matchedSkills = [];
        const missingSkills = [];

        REQUIRED_SKILLS.forEach(reqSkill => {
            const found = analysis.extractedSkills.find(s => s.name === reqSkill);
            if (found) {
                matchedSkills.push(found);
            } else {
                missingSkills.push({
                    name: reqSkill,
                    percentage: 0,
                    level: 'none'
                });
            }
        });

        const overallMatchPercentage = Math.round((matchedSkills.length / REQUIRED_SKILLS.length) * 100);

        res.json({
            overallMatchPercentage,
            matchedSkills,
            missingSkills,
            extractedSkills: analysis.extractedSkills,
            profileSummary: analysis.profileSummary,
            careerLevel: analysis.careerLevel,
            strengths: analysis.strengths,
            projects: analysis.projects,
            requiredSkillsCount: REQUIRED_SKILLS.length,
            debugRawText: text.substring(0, 2000),
            unreadable: false
        });

    } catch (error) {
        console.error("[CRITICAL] Processing failure:", error);
        res.status(500).json({ error: 'Deep analysis failed' });
    }
});

/**
 * NEW: Generate Randomized 10 Questions based on Skills
 */
app.post('/api/verify-resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        let text = '';
        let html = '';
        const path = req.file.path;
        const name = req.file.originalname.toLowerCase();

        if (name.endsWith('.pdf')) {
            text = await extractTextFromPDF(path);
            html = text; // Fallback to raw text for PDF
        } else if (name.endsWith('.docx')) {
            text = await extractTextFromDOCX(path);
            const htmlResult = await mammoth.convertToHtml({ path: path });
            html = htmlResult.value;
        } else {
            return res.status(400).json({ error: 'Unsupported format' });
        }

        if (fs.existsSync(path)) fs.unlinkSync(path);

        const textLower = text.toLowerCase();
        const htmlLower = html.toLowerCase();

        // Relaxed verification: if the word "github" appears in anyway (either text or embedded href), verify it.
        const isVerified = textLower.includes('github') || htmlLower.includes('github');

        res.json({ verified: isVerified });
    } catch (error) {
        console.error("[CRITICAL] Verification failure:", error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

app.post('/api/generate-questions', (req, res) => {
    const { skills } = req.body;
    console.log(`[INFO] Question request for skills: ${skills?.join(', ') || 'none'}`);
    let pool = [];

    if (skills && Array.isArray(skills)) {
        skills.forEach(skill => {
            if (QUESTION_BANK[skill]) {
                pool = [...pool, ...QUESTION_BANK[skill]];
            }
        });
    }

    console.log(`[DEBUG] Skill-pool size: ${pool.length}, General-pool size: ${GENERAL_QUESTIONS.length}`);

    // Shuffle and pick 10
    const shuffled = [...pool, ...GENERAL_QUESTIONS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);

    console.log(`[INFO] Returning ${selected.length} randomized questions`);
    res.json({ questions: selected });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`V2.2 AI Assessment Backend READY on http://localhost:${PORT}`);
});
