# Google Classroom MCP Server

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![License](https://img.shields.io/badge/license-MIT-brightgreen)
![MCP](https://img.shields.io/badge/MCP-compatible-purple)
![Tools](https://img.shields.io/badge/tools-46-orange)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that gives AI agents full programmatic access to Google Classroom. Built to enable complex, multi-step automation workflows for educators: from bulk assignment creation and roster management to submission collection, grading, and Drive file delivery.

## Why This Exists

AI agents need structured, reliable access to educational platforms to be genuinely useful in teaching workflows. This server was born from the need to integrate AI assistants into real classroom management — automating repetitive tasks, orchestrating multi-step flows (create topic → assign work → collect submissions → grade), and letting LLM-based tools act as a capable assistant for teachers.

## Features

- **46 fully implemented tools** — courses, topics, assignments, materials, announcements, submissions, grading, rosters, guardians, rubrics, and Drive file management
- **Google Drive integration** — upload files to Drive and attach them to assignments; download student submission PDFs
- **Compact responses by default** — list operations return only essential fields to stay within MCP token limits; pass `fullData: true` for complete objects
- **OAuth2 authentication** with persistent token storage and automatic refresh
- **Environment variable overrides** for `credentials.json` and `token.json` paths

---

## Installation

### Prerequisites

- Node.js 18+
- A Google account with Google Classroom access (teacher role)
- A Google Cloud project with the Classroom API enabled

### Step 1 — Clone and build

```bash
git clone https://github.com/adriasantacreu/google-classroom-mcp.git
cd google-classroom-mcp
npm install
npm run build
```

### Step 2 — Create Google OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the Classroom API: **APIs & Services > Library > Google Classroom API > Enable**
3. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**
4. Application type: **Desktop app**
5. Download the JSON and save it as `credentials.json` in the project root

### Step 3 — Authenticate

```bash
node auth.js
```

Open the printed URL in your browser, authorize the app, paste the code. A `token.json` file is created and stored locally.

---

## Configure Your MCP Client

Pick your client and add the server configuration. Replace `/absolute/path/to/google-classroom-mcp` with the actual path on your system.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "google-classroom": {
      "command": "node",
      "args": ["/absolute/path/to/google-classroom-mcp/dist/index.js"]
    }
  }
}
```

### Cursor

Edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "google-classroom": {
      "command": "node",
      "args": ["/absolute/path/to/google-classroom-mcp/dist/index.js"]
    }
  }
}
```

### VS Code (with GitHub Copilot)

Edit your user `settings.json` or `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "google-classroom": {
        "type": "stdio",
        "command": "node",
        "args": ["/absolute/path/to/google-classroom-mcp/dist/index.js"]
      }
    }
  }
}
```

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "google-classroom": {
      "command": "node",
      "args": ["/absolute/path/to/google-classroom-mcp/dist/index.js"]
    }
  }
}
```

### Custom paths (optional)

If your `credentials.json` or `token.json` are not in the project root, use environment variables:

```json
{
  "mcpServers": {
    "google-classroom": {
      "command": "node",
      "args": ["/absolute/path/to/google-classroom-mcp/dist/index.js"],
      "env": {
        "GOOGLE_CREDENTIALS_PATH": "/path/to/credentials.json",
        "GOOGLE_TOKEN_PATH": "/path/to/token.json"
      }
    }
  }
}
```

Restart your MCP client after editing the config.

---

## OAuth Scopes

The server requests the following scopes during `node auth.js`:

| Scope | Purpose |
|-------|---------|
| `classroom.courses` | Read/write courses |
| `classroom.coursework.students` | Manage assignments and submissions |
| `classroom.coursework.me` | Access own coursework |
| `classroom.courseworkmaterials` | Manage course materials |
| `classroom.announcements` | Post and manage announcements |
| `classroom.rosters` | Manage students and teachers |
| `classroom.topics` | Manage course topics |
| `classroom.guardianlinks.students` | Manage student guardians |
| `classroom.profile.emails` | Read user email addresses |
| `classroom.profile.photos` | Read user profile photos |
| `drive.file` | Upload files to Drive |
| `drive.readonly` | Download student-uploaded submission files |

---

## Tool Reference

### Courses

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_list_courses` | — | `courseStates`, `pageSize`, `pageToken`, `fullData` | List all courses. `courseStates`: ACTIVE, ARCHIVED, PROVISIONED |
| `classroom_search_courses` | `query` | — | Search courses by name or section (case-insensitive) |
| `classroom_get_course` | `courseId` | — | Get full details of a single course |
| `classroom_create_course` | `name` | `section`, `description`, `room`, `ownerId` | Create a new course |
| `classroom_update_course` | `courseId` | `name`, `section`, `description`, `room`, `state` | Update course fields. `state`: ACTIVE, ARCHIVED |
| `classroom_delete_course` | `courseId` | — | Archive then delete a course |

### Topics

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_get_topic` | `courseId`, `id` | — | Get details of a specific topic |
| `classroom_list_topics` | `courseId` | — | List all topics in a course |
| `classroom_create_topic` | `courseId`, `name` | — | Create a new topic/unit |
| `classroom_patch_topic` | `courseId`, `id`, `name` | — | Rename a topic |
| `classroom_delete_topic` | `courseId`, `id` | — | Delete a topic |

### Assignments

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_get_assignment` | `courseId`, `id` | — | Get full details of a single assignment |
| `classroom_list_assignments` | `courseId` | `courseWorkStates`, `pageSize`, `pageToken` | List assignments. `courseWorkStates`: PUBLISHED, DRAFT |
| `classroom_create_assignment` | `courseId`, `title` | `description`, `workType`, `state`, `maxPoints`, `dueDate` (YYYY-MM-DD), `dueTime` (HH:MM), `topicId`, `attachments` | Create assignment or question |
| `classroom_patch_assignment` | `courseId`, `id`, `updateMask` | `title`, `description`, `maxPoints`, `topicId`, `dueDate`, `dueTime`, `state` | Partial update via updateMask |
| `classroom_update_assignment` | `courseId`, `id` | `title`, `description`, `maxPoints`, `dueDate`, `dueTime`, `topicId`, `state` | Full update of all mutable fields |
| `classroom_delete_assignment` | `courseId`, `id` | — | Permanently delete an assignment |
| `classroom_move_to_topic` | `courseId`, `id`, `topicId` | — | Move assignment to a topic. Pass `""` to unassign |

**Attachment format** (for `classroom_create_assignment`):
```json
"attachments": [
  { "type": "driveFile", "idOrUrl": "<drive-file-id>" },
  { "type": "link",      "idOrUrl": "https://example.com" },
  { "type": "youtubeVideo", "idOrUrl": "<video-id>" },
  { "type": "form",     "idOrUrl": "https://forms.gle/..." }
]
```

### Materials

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_get_material` | `courseId`, `id` | — | Get full details of a specific material |
| `classroom_list_materials` | `courseId` | `pageSize` | List all non-graded materials |
| `classroom_create_material` | `courseId`, `title` | `description`, `topicId`, `attachments` | Create a material post |
| `classroom_patch_material` | `courseId`, `id`, `updateMask` | `title`, `description`, `topicId`, `state` | Update material fields |
| `classroom_delete_material` | `courseId`, `id` | — | Delete a material |

### Announcements

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_list_announcements` | `courseId` | `pageSize` | List announcements |
| `classroom_post_announcement` | `courseId`, `text` | — | Post to the course stream |
| `classroom_patch_announcement` | `courseId`, `id`, `text` | — | Edit announcement text |
| `classroom_delete_announcement` | `courseId`, `id` | — | Delete an announcement |

### Submissions

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_list_submissions` | `courseId`, `courseWorkId` | `states`, `pageSize` | List submissions. Use `"-"` as `courseWorkId` to get all submissions in a course. `states`: NEW, CREATED, TURNED_IN, RETURNED |
| `classroom_grade_submission` | `courseId`, `courseWorkId`, `id`, `grade` | `draft` | Set a grade. `draft: true` sets only draftGrade |
| `classroom_return_submission` | `courseId`, `courseWorkId`, `id` | — | Return a graded submission to the student |

### Rosters — Students

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_list_students` | `courseId` | `pageSize` | List enrolled students |
| `classroom_add_student` | `courseId`, `email` | — | Invite a student by email (sends an invitation) |
| `classroom_delete_student` | `courseId`, `userId` | — | Remove a student. `userId`: email or user ID |

### Rosters — Teachers

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_list_teachers` | `courseId` | — | List co-instructors |
| `classroom_invite_teacher` | `courseId`, `email` | — | Invite a co-teacher by email |
| `classroom_delete_teacher` | `courseId`, `userId` | — | Remove a teacher |

### Guardians

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_list_guardians` | `studentId` | — | List guardians for a student |
| `classroom_invite_guardian` | `studentId`, `guardianEmail` | — | Send a guardian invitation |
| `classroom_delete_guardian` | `studentId`, `guardianId` | — | Remove a guardian |

### Rubrics

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_list_rubrics` | `courseId`, `courseWorkId` | — | List rubrics for an assignment |
| `classroom_create_rubric` | `courseId`, `courseWorkId`, `criteria` | — | Create a rubric with criteria array |
| `classroom_patch_rubric` | `courseId`, `courseWorkId`, `id`, `criteria` | — | Update rubric criteria |
| `classroom_delete_rubric` | `courseId`, `courseWorkId`, `id` | — | Delete a rubric |

### User Profile

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `classroom_get_user_profile` | `userId` | — | Get profile by email or user ID |

### Drive & File Attachments

| Tool | Required params | Optional params | Description |
|------|----------------|-----------------|-------------|
| `drive_upload_file` | `name`, `base64Content` | `mimeType` | Upload a base64-encoded file to Drive. Returns file ID and URL |
| `classroom_upload_to_classroom` | `courseId`, `title`, `fileName`, `base64Content` | `description`, `topicId`, `mimeType` | Upload file to Drive and attach it as a material in one step |

---

## Known API Limitations

- **Course deletion** requires the course to be `ARCHIVED` first — the tool handles this automatically
- **Materials cannot be edited** after creation — the Classroom API does not provide a PATCH endpoint for materials; `classroom_patch_material` is declared but will be rejected by the API for most fields
- **Assignment `workType`** (ASSIGNMENT, SHORT_ANSWER_QUESTION, MULTIPLE_CHOICE_QUESTION) cannot be changed after creation
- **Assignment `state`** can only be moved to `PUBLISHED` — reverting to DRAFT is not supported by the API
- **Assignment attachments** cannot be modified after creation — this is an API restriction
- **`drive.file` scope** only grants access to files created by this app. The `drive.readonly` scope (included by default) is needed to download student-uploaded submissions
- **Guardian management** requires the Google Workspace admin to have enabled the guardian feature for the domain
- **`classroom_add_student`** sends an enrollment *invitation* — the student must accept it; it does not enroll directly
- **Modifying web-created content** — `ProjectPermissionDenied` is returned when trying to patch or move coursework that was created via the Classroom web interface or another app. The API only allows modifying items created by the same OAuth project (`associatedWithDeveloper: true`). This is a Google API restriction, not a scope issue
- **Rubrics API** requires **Google Workspace for Education Plus** or **Teaching and Learning Upgrade** license. Accounts on Education Fundamentals (free tier) will receive `UserIneligibleToModifyRubrics`. See [Google's rubrics limitations](https://developers.google.com/classroom/rubrics/limitations#license-requirements)

---

## Troubleshooting

**`Authentication token not found. Run auth flow first.`**
Run `node auth.js` and complete the OAuth flow. A `token.json` file must exist before starting the server.

**`Token expired or invalid`**
Delete `token.json` and run `node auth.js` again to re-authenticate.

**`Some requested scopes were invalid`**
Your token was generated with an outdated scope list. Delete `token.json` and re-run `node auth.js`.

**`ProjectPermissionDenied` when grading**
The authenticated account does not have permission to grade in that course. Verify you are the course owner or a co-teacher.

**`UserInIllegalDomain` when adding a student**
The invited email belongs to a domain not allowed by your Google Workspace policy. This is a domain-level restriction, not an API bug.

**List responses truncated or missing fields**
By default, list tools return compact fields to stay within MCP token limits. Pass `fullData: true` to get the complete API response.

**MCP server not loading in client**
- Verify the path in your config points to `dist/index.js`, not `src/index.ts`
- Make sure you ran `npm run build` after any source changes
- Restart the MCP client after config changes

---

## Running Tests

Tests run against a real Google Classroom course and will create and delete live data.

```bash
# Set your test course ID
export TEST_COURSE_ID=your_course_id_here

# Functional tests — one tool at a time, with cleanup
node tests/test-basic.js

# Integration tests — cross-tool workflows and data consistency
node tests/test-integration.js
```

---

## Project Structure

```
google-classroom-mcp/
├── src/
│   └── index.ts              # MCP server — all 46 tools (TypeScript source)
├── dist/
│   └── index.js              # Compiled output — point your MCP client here
├── tests/
│   ├── test-basic.js         # Functional tests for each tool individually
│   └── test-integration.js   # Cross-tool workflow and consistency tests
├── auth.js                   # OAuth2 token generator
├── smithery.yaml             # Smithery marketplace config
├── credentials.json          # Your OAuth credentials (git-ignored)
├── token.json                # Generated auth token (git-ignored)
└── package.json
```

---

## Contributing

Issues and pull requests are welcome. When adding new tools:
1. Declare the tool in `getTools()` with a complete `inputSchema`
2. Add a matching `case` in `handleToolCall()`
3. Add a test in `tests/test-basic.js`

Follow the existing patterns for compact/fullData responses and error handling.

## License

MIT
