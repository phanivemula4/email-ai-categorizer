import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { Client } from "@elastic/elasticsearch";
import { GoogleGenerativeAI } from "@google/generative-ai"; // --- CHANGE 1: Import Google instead of Cohere ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
dotenv.config();
const app = express();
const port = 5555;
app.use(cors());
// --- Credentials ---
const imapUser = process.env.IMAP_USER;
const imapPass = process.env.IMAP_PASS;
// --- CHANGE 2: Use the GOOGLE_API_KEY from your .env file ---
const googleApiKey = process.env.GOOGLE_API_KEY;
if (!imapUser || !imapPass || !googleApiKey) {
    throw new Error("Missing required environment variables in .env file (IMAP_USER, IMAP_PASS, GOOGLE_API_KEY)");
}
// --- Elasticsearch Client Setup ---
const esClient = new Client({ node: "http://localhost:9200" });
const esIndex = "emails";
async function setupEsIndex() {
    const indexExists = await esClient.indices.exists({ index: esIndex });
    if (!indexExists) {
        console.log(`Creating Elasticsearch index: ${esIndex}`);
        await esClient.indices.create({ index: esIndex });
    }
}
// --- CHANGE 3: Rewritten AI Categorization Function using Google Gemini ---
async function categorizeEmail(content) {
    try {
        const genAI = new GoogleGenerativeAI(googleApiKey);
        const CATEGORIES = ["Interested", "Meeting Booked", "Not Interested", "Spam", "Out of Office"];
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        // The prompt must be a template literal, using backticks ``
        const prompt = `Based on the following email content, classify it into ONE of the following categories: ${CATEGORIES.join(', ')}. Return ONLY the category name. Email Content: """${content.substring(0, 4000)}""" Category:`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const category = response.text().trim();
        return CATEGORIES.includes(category) ? category : "Uncategorized";
    }
    catch (error) {
        console.error("❌ AI categorization failed:", error);
        return "Uncategorized";
    }
}
// --- Main Route to Fetch, Process, and Return Emails ---
app.get("/emails", async (req, res) => {
    try {
        // --- Part 1: Fetch and process NEW emails from the inbox ---
        const client = new ImapFlow({
            host: "imap.gmail.com", port: 993, secure: true,
            auth: { user: imapUser, pass: imapPass }, logger: false
        });
        await client.connect();
        await client.mailboxOpen("INBOX");
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const messageIds = await client.search({ since: thirtyDaysAgo });
        let newEmailsCategorized = 0;
        if (messageIds && messageIds.length > 0) {
            for await (let msg of client.fetch(messageIds, { envelope: true, source: true })) {
                if (msg.source) {
                    const alreadyExists = await esClient.exists({ index: esIndex, id: String(msg.uid) });
                    if (alreadyExists)
                        continue;
                    const parsed = await simpleParser(msg.source);
                    await delay(1000); // Respect API rate limits
                    const category = await categorizeEmail(parsed.text || "");
                    newEmailsCategorized++;
                    const emailData = {
                        uid: msg.uid, subject: parsed.subject ?? "No subject", from: parsed.from?.text ?? "No sender",
                        date: parsed.date ?? new Date(), body: parsed.html || parsed.text || "", category: category
                    };
                    await esClient.index({ index: esIndex, id: String(msg.uid), document: emailData });
                }
            }
        }
        console.log(`✅ Processed and indexed ${newEmailsCategorized} new emails.`);
        await client.logout();
        // --- Part 2: Return ALL categorized emails from the last 30 days from our database ---
        const searchResult = await esClient.search({
            index: esIndex,
            size: 1000, // Get up to 1000 emails
            sort: [{ date: "desc" }], // Sort by newest first
            query: {
                range: {
                    date: { gte: thirtyDaysAgo.toISOString() }
                }
            }
        });
        const allRecentEmails = searchResult.hits.hits.map((hit) => hit._source);
        res.json(allRecentEmails);
    }
    catch (err) {
        console.error("❌ Error in /emails route:", err?.message || err);
        res.status(500).json({ error: err?.message || "An unknown error occurred" });
    }
});
// --- Search Route powered by Elasticsearch ---
app.get("/search", async (req, res) => {
    // ... (This route remains the same, no changes needed)
    const query = req.query.q;
    if (!query)
        return res.status(400).json({ error: "Query parameter 'q' is required." });
    try {
        const result = await esClient.search({
            index: esIndex,
            query: {
                multi_match: { query, fields: ["from", "subject", "body"], fuzziness: "AUTO" }
            }
        });
        const hits = result.hits.hits.map((hit) => hit._source);
        res.json(hits);
    }
    catch (err) {
        console.error("❌ Elasticsearch search failed:", err?.message || err);
        res.status(500).json({ error: "Search failed" });
    }
});
app.get("/", (req, res) => res.send("✅ Server is running."));
app.listen(port, async () => {
    await setupEsIndex();
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`🔍 Elasticsearch connected and index '${esIndex}' is ready.`);
});
// import express, { Request, Response } from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import { ImapFlow } from "imapflow";
// import { simpleParser } from "mailparser";
// import { Client } from "@elastic/elasticsearch";
// import { CohereClient } from "cohere-ai"; 
// const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// dotenv.config();
// const app = express();
// const port = 5555;
// app.use(cors());
// const imapUser = process.env.IMAP_USER;
// const imapPass = process.env.IMAP_PASS;
// const cohereApiKey = process.env.COHERE_API_KEY;
// if (!imapUser || !imapPass || !cohereApiKey) {
//     throw new Error("Missing required environment variables in .env file (IMAP_USER, IMAP_PASS, COHERE_API_KEY)");
// }
// const esClient = new Client({ node: "http://localhost:9200" });
// const esIndex = "emails";
// async function setupEsIndex() {
//     const indexExists = await esClient.indices.exists({ index: esIndex });
//     if (!indexExists) {
//         console.log(`Creating Elasticsearch index: ${esIndex}`);
//         await esClient.indices.create({ index: esIndex });
//     }
// }
// // --- CHANGE 3: Rewritten AI Categorization Function using Cohere ---
// // --- AI Categorization Function using Cohere ---
// async function categorizeEmail(content: string): Promise<string> {
//     try {
//         const cohere = new CohereClient({ token: cohereApiKey! });
//         const CATEGORIES = ["Interested", "Meeting Booked", "Not Interested", "Spam", "Out of Office"];
//         // Cohere's Classify endpoint works best with examples
//         const examples = [
//             { text: "Thanks for your email. This looks interesting, can you send more details?", label: "Interested" },
//             { text: "Perfect, I've booked a time on your calendar for Tuesday at 3 PM.", label: "Meeting Booked" },
//             { text: "We are not interested at this time. Please remove us from your mailing list.", label: "Not Interested" },
//             { text: "URGENT: Claim your FREE prize now! Limited time offer!", label: "Spam" },
//             { text: "I am currently out of the office and will respond upon my return on Monday.", label: "Out of Office" },
//             { text: "This is great, let's connect next week.", label: "Interested" },
//             { text: "Thank you for the message, but this is not a priority for us right now.", label: "Not Interested" },
//         ];
//         const response = await cohere.classify({
//             model: 'embed-english-v2.0',
//             inputs: [content.substring(0, 4000)],
//             examples: examples,
//         });
//         const category = response.classifications[0].prediction;
//         if (category && CATEGORIES.includes(category)) {
//             return category;
//         } else {
//             return "Uncategorized";
//         }
//     } catch (error) {
//         console.error("❌ AI categorization failed:", error);
//         return "Uncategorized";
//     }
// }
// // --- Main Route to Fetch, Parse, Categorize, AND INDEX Emails ---
// app.get("/emails", async (req: Request, res: Response) => {
//     try {
//         const client = new ImapFlow({
//             host: "imap.gmail.com", port: 993, secure: true,
//             auth: { user: imapUser!, pass: imapPass! }, logger: false
//         });
//         await client.connect();
//         await client.mailboxOpen("INBOX");
//         const thirtyDaysAgo = new Date();
//         thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
//         const messageIds = await client.search({ since: thirtyDaysAgo });
//         if (!messageIds || messageIds.length === 0) {
//             await client.logout();
//             return res.json([]);
//         }
//         const emails = [];
//         let newEmailsCategorized = 0;
//         for await (let msg of client.fetch(messageIds, { envelope: true, source: true })) {
//             if (msg.source) {
//                 const alreadyExists = await esClient.exists({ index: esIndex, id: String(msg.uid) });
//                 if (alreadyExists) continue;
//                 const parsed = await simpleParser(msg.source);
//                 await delay(1000); 
//                 const category = await categorizeEmail(parsed.text || "");
//                 newEmailsCategorized++;
//                 const emailData = {
//                     uid: msg.uid,
//                     subject: parsed.subject ?? "No subject",
//                     from: parsed.from?.text ?? "No sender",
//                     date: parsed.date ?? new Date(),
//                     body: parsed.html || parsed.text || "",
//                     category: category
//                 };
//                 await esClient.index({ index: esIndex, id: String(msg.uid), document: emailData });
//                 emails.push(emailData);
//             }
//         }
//         console.log(`✅ Categorized and indexed ${newEmailsCategorized} new emails.`);
//         await client.logout();
//         res.json(emails);
//     } catch (err: any) {
//         console.error("❌ Error in /emails route:", err?.message || err);
//         res.status(500).json({ error: err?.message || "An unknown error occurred" });
//     }
// });
// // --- Search Route powered by Elasticsearch ---
// app.get("/search", async (req: Request, res: Response) => {
//     const query = req.query.q as string;
//     if (!query) return res.status(400).json({ error: "Query parameter 'q' is required." });
//     try {
//         const result = await esClient.search({
//             index: esIndex,
//             query: {
//                 multi_match: { query, fields: ["from", "subject", "body"], fuzziness: "AUTO" }
//             }
//         });
//         const hits = result.hits.hits.map((hit: any) => hit._source);
//         res.json(hits);
//     } catch(err: any) {
//         console.error("Elasticsearch search failed:", err?.message || err);
//         res.status(500).json({ error: "Search failed" });
//     }
// });
// app.get("/", (req: Request, res: Response) => res.send("Server is running."));
// app.listen(port, async () => {
//     await setupEsIndex();
//     console.log(`Server running on http://localhost:${port}`);
//     console.log(`Elasticsearch connected and index '${esIndex}' is ready.`);
// });
