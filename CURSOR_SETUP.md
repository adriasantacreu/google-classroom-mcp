# Google Classroom MCP Setup for Cursor

Quick setup guide for using the Google Classroom MCP server in Cursor.

## ✅ Step 1: Installation (Complete)

Already done:
- ✅ Installed dependencies: `npm install`
- ✅ Built TypeScript: `npm run build`
- ✅ Added to Cursor MCP config: `~/.cursor/mcp.json`

## 🔑 Step 2: Authentication

### Enable Google Classroom API

```bash
# Set your GCP project
gcloud config set project YOUR_PROJECT_ID

# Enable Classroom API
gcloud services enable classroom.googleapis.com
```

### Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Application type: **Desktop app**
5. Name: "classroom-mcp"
6. Click **Create**
7. **Download JSON** → save as `~/GitHub/classroom-mcp/credentials.json`

### Generate Token

```bash
cd ~/GitHub/classroom-mcp
node auth.js
```

Follow the prompts:
1. Open the URL in your browser
2. Sign in with your Google account (must have Classroom teacher access)
3. Copy the authorization code
4. Paste into terminal
5. `token.json` will be created

## 🔄 Step 3: Restart Cursor

**Important:** Quit and reopen Cursor to load the MCP server.

## ✅ Step 4: Test

Open Cursor AI chat and try:

```
List my Google Classroom courses
```

Or:

```
Use classroom_list_courses to show all my courses
```

You should see the MCP tool called and courses listed (if you have any).

## 🎯 Using with AIN 2001

### Create Course

In Cursor AI chat:

```
Use classroom_create_course to create:
- Name: AIN 2001 — Artificial Intelligence: A Modern Approach
- Section: Summer 2026
- Description: Survey of artificial intelligence following Russell & Norvig's textbook. Topics: search, logic, probability, machine learning, NLP, ethics.
```

Save the course ID returned.

### Create Assignments

```
For course ID [YOUR_COURSE_ID], create an assignment:
- Title: Lecture 1: Introduction
- Description: [paste from populi-assignments/lecture-01-introduction.md]
- Due date: 2026-06-01
- Points: 10
- Materials: Link to slides and GitHub Classroom
```

Repeat for all 24 lectures, or use the batch script in the main docs.

## 🔧 Troubleshooting

### "No credentials.json found"
Download OAuth credentials from Google Cloud Console (see Step 2).

### "Token expired"
Delete `token.json` and run `node auth.js` again.

### "Insufficient permission"
Your Google account needs Classroom teacher access. Check scopes in auth.js.

### MCP not connecting in Cursor
1. Check `~/.cursor/mcp.json` has correct path
2. Restart Cursor
3. Check Cursor output panel for MCP logs

## 📚 Full Documentation

See `docs/GOOGLE_CLASSROOM_SETUP.md` in samwise-aima for complete guide.
