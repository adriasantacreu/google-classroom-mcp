# Google Classroom MCP - Quick Reference

## ✅ Installation Status

**Location:** `~/GitHub/classroom-mcp`

- ✅ **Dependencies installed:** `npm install` (complete)
- ✅ **TypeScript built:** `npm run build` (complete)
- ✅ **Added to Cursor:** `~/.cursor/mcp.json` (complete)

## 🔑 Next Steps: Authentication

### 1. Enable Classroom API

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable classroom.googleapis.com
```

### 2. Get OAuth Credentials

1. Go to https://console.cloud.google.com
2. Select your project
3. **APIs & Services → Credentials**
4. **Create Credentials → OAuth client ID**
5. Type: **Desktop app**
6. Download JSON → save as `~/GitHub/classroom-mcp/credentials.json`

### 3. Generate Token

```bash
cd ~/GitHub/classroom-mcp
node auth.js
```

- Opens browser for Google sign-in
- Copy authorization code
- Paste into terminal
- Creates `token.json`

### 4. Restart Cursor

**Important:** Quit and reopen Cursor to load the MCP server.

## 🧪 Test in Cursor

Open Cursor AI chat:

```
List my Google Classroom courses
```

or:

```
Use classroom_list_courses
```

## 🎯 Create AIN 2001 Course

In Cursor AI chat:

```
Use classroom_create_course with:
- Name: AIN 2001 — Artificial Intelligence: A Modern Approach
- Section: Summer 2026
- Description: Survey of AI following Russell & Norvig's textbook
```

Returns course ID (save this!).

## 📝 Create Assignment

```
Use classroom_create_assignment for course [COURSE_ID]:
- Title: Lecture 1: Introduction
- Description: [paste from ~/GitHub/samwise-aima/populi-assignments/lecture-01-introduction.md]
- Due: 2026-06-01 at 23:59
- Points: 10
- Materials: 
  - Link to slides
  - Link to GitHub Classroom assignment
```

## 🔧 Available MCP Tools

| Tool | Purpose |
|------|---------|
| `classroom_create_course` | Create new course |
| `classroom_list_courses` | List all your courses |
| `classroom_get_course` | Get course details |
| `classroom_create_assignment` | Create assignment |
| `classroom_list_assignments` | List course assignments |
| `classroom_post_announcement` | Post to course stream |
| `classroom_add_student` | Add/invite student |

## 📂 File Locations

| File | Purpose |
|------|---------|
| `~/GitHub/classroom-mcp/credentials.json` | OAuth credentials (create this) |
| `~/GitHub/classroom-mcp/token.json` | Generated auth token |
| `~/GitHub/classroom-mcp/auth.js` | Authentication script |
| `~/.cursor/mcp.json` | Cursor MCP config (already updated) |

## 🔗 Documentation

- **Cursor Setup:** `~/GitHub/classroom-mcp/CURSOR_SETUP.md`
- **Full Guide:** `~/GitHub/samwise-aima/docs/GOOGLE_CLASSROOM_SETUP.md`
- **MCP README:** `~/GitHub/classroom-mcp/README.md`

## 🆘 Troubleshooting

### "credentials.json not found"
→ Create OAuth credentials in Google Cloud Console (step 2)

### "Token expired"
→ Delete `token.json` and run `node auth.js` again

### MCP not showing in Cursor
→ Restart Cursor (quit and reopen)

### "Insufficient permission"
→ Sign in with account that has Classroom teacher access

## 📊 Current Status

```
✅ classroom-mcp installed at ~/GitHub/classroom-mcp
✅ Built and ready (dist/index.js exists)
✅ Added to Cursor MCP config
⏳ Waiting for: OAuth credentials + token generation
```

**Next:** Follow steps above to create `credentials.json` and run `node auth.js`
