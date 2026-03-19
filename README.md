# Google Classroom MCP Server

A Model Context Protocol (MCP) server that provides AI agents with full access to the Google Classroom API. Built to enable complex automation workflows for educators — from bulk assignment creation to submission review and grading — as part of AI-driven productivity integrations.

## Why This Exists

Modern AI agents need structured access to educational platforms to be genuinely useful in teaching workflows. This server was created out of the need to integrate AI assistants into real classroom management: automating repetitive tasks, orchestrating multi-step flows (create topic → assign work → collect submissions → grade), and allowing LLM-based tools to act as a reliable assistant for teachers.

## Features

- **43 fully implemented tools** covering courses, assignments, materials, announcements, topics, submissions, grading, rosters, guardians, rubrics, and Drive file management
- **Google Drive integration** — upload files and attach them to assignments; download student submission PDFs
- **Compact responses by default** — list operations return only essential fields to stay within MCP token limits; use `fullData: true` when you need complete objects
- **OAuth2 authentication** with persistent token storage and automatic refresh

## Requirements

- Node.js 18+
- A Google Cloud project with the Classroom API enabled
- OAuth2 credentials (Desktop app type)
- A Google account with Google Classroom access (teacher role recommended)

## Setup

### 1. Enable APIs and Create Credentials

```bash
# Enable Classroom API
gcloud services enable classroom.googleapis.com

# Or enable it in the Google Cloud Console:
# APIs & Services -> Library -> Google Classroom API -> Enable
```

In the [Google Cloud Console](https://console.cloud.google.com):
1. Go to **APIs & Services -> Credentials**
2. Click **Create Credentials -> OAuth client ID**
3. Application type: **Desktop app**
4. Download the JSON file and save it as `credentials.json` in the project root

### 2. Install and Build

```bash
git clone https://github.com/your-username/google-classroom-mcp
cd google-classroom-mcp
npm install
npm run build
```

### 3. Authenticate

```bash
node auth.js
```

Follow the printed instructions: open the URL, authorize the app, paste the code. A `token.json` file will be created.

### 4. Configure Your MCP Client

Add this to your MCP client configuration (e.g., Claude Desktop `claude_desktop_config.json`):

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

Restart your MCP client after adding the configuration.

## OAuth Scopes

The server requests the following scopes:

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
| `classroom.profile.emails` | Read user emails |
| `classroom.profile.photos` | Read user profile photos |
| `drive.file` | Upload files via Drive |
| `drive.readonly` | Download student submission files |

## Tool Reference

### Courses

| Tool | Description |
|------|-------------|
| `classroom_list_courses` | List all courses (teacher/student). Supports `fullData`, `teacherId`, `studentId`, `courseStates` filters |
| `classroom_get_course` | Get a single course by ID |
| `classroom_search_courses` | Search courses by name (case-insensitive substring match) |
| `classroom_create_course` | Create a new course |
| `classroom_update_course` | Update course fields (name, section, description, room, state) |
| `classroom_delete_course` | Delete a course (must be ARCHIVED first) |

### Topics

| Tool | Description |
|------|-------------|
| `classroom_list_topics` | List all topics in a course |
| `classroom_create_topic` | Create a new topic |
| `classroom_update_topic` | Rename a topic |
| `classroom_delete_topic` | Delete a topic |

### Assignments (CourseWork)

| Tool | Description |
|------|-------------|
| `classroom_list_assignments` | List assignments. Supports `courseWorkStates`, `fullData`, `pageSize` |
| `classroom_get_assignment` | Get a single assignment by ID |
| `classroom_create_assignment` | Create an assignment with optional due date, points, topic, attachments |
| `classroom_patch_assignment` | Update assignment fields (title, description, points, topic, due date) |
| `classroom_delete_assignment` | Delete an assignment |
| `classroom_move_assignment_to_topic` | Move an assignment to a different topic |

### Materials

| Tool | Description |
|------|-------------|
| `classroom_list_materials` | List course materials |
| `classroom_get_material` | Get a single material by ID |
| `classroom_create_material` | Create a material with optional topic and attachments |
| `classroom_delete_material` | Delete a material |

**Note:** Google Classroom does not support editing materials after creation (API limitation).

### Announcements

| Tool | Description |
|------|-------------|
| `classroom_list_announcements` | List announcements |
| `classroom_post_announcement` | Post a new announcement |
| `classroom_patch_announcement` | Update announcement text |
| `classroom_delete_announcement` | Delete an announcement |

### Submissions

| Tool | Description |
|------|-------------|
| `classroom_list_submissions` | List submissions. Use `courseWorkId: "-"` for all submissions in a course. Supports `userId` filter |
| `classroom_get_submission` | Get a single submission |
| `classroom_grade_submission` | Set a grade (draftGrade and assignedGrade) on a submission |
| `classroom_return_submission` | Return a submission to the student |
| `classroom_download_submission` | Download a student submission file from Drive (returns base64) |

### Rosters

| Tool | Description |
|------|-------------|
| `classroom_list_students` | List students enrolled in a course |
| `classroom_add_student` | Invite a student to a course by email (sends invitation) |
| `classroom_remove_student` | Remove a student from a course |
| `classroom_list_teachers` | List teachers in a course |
| `classroom_add_teacher` | Invite a teacher to a course by email |
| `classroom_remove_teacher` | Remove a teacher from a course |

### Guardians

| Tool | Description |
|------|-------------|
| `classroom_list_guardians` | List guardians for a student |
| `classroom_invite_guardian` | Send a guardian invitation |
| `classroom_delete_guardian` | Remove a guardian |

### Rubrics

| Tool | Description |
|------|-------------|
| `classroom_list_rubrics` | List rubrics for an assignment |
| `classroom_get_rubric` | Get a rubric by ID |
| `classroom_create_rubric` | Create a rubric with criteria and levels |
| `classroom_update_rubric` | Update rubric criteria |
| `classroom_delete_rubric` | Delete a rubric |

### User Profile

| Tool | Description |
|------|-------------|
| `classroom_get_user_profile` | Get a user profile by email or user ID |

### Invitations

| Tool | Description |
|------|-------------|
| `classroom_list_invitations` | List pending invitations |
| `classroom_delete_invitation` | Cancel a pending invitation |

### Drive

| Tool | Description |
|------|-------------|
| `drive_upload_file` | Upload a file to Google Drive and return its file ID |
| `classroom_upload_to_classroom` | Upload a file to Drive and immediately attach it to an assignment |

## Known API Limitations

- **Course deletion** requires the course to be in `ARCHIVED` state first
- **Materials cannot be edited** after creation — the Classroom API does not expose a patch endpoint for materials
- **Assignment `workType`** (ASSIGNMENT, SHORT_ANSWER_QUESTION, MULTIPLE_CHOICE_QUESTION) cannot be changed after creation
- **Assignment `state`** can only be changed to `PUBLISHED`, not back to `DRAFT`
- **`drive.file` scope** only allows downloading files created by the app. Use `drive.readonly` (included in default scopes) to download student-uploaded submissions
- **Submission grading** may return `ProjectPermissionDenied` if the authenticated user does not have grading rights on that course

## Re-authenticating

If you add or change scopes, delete `token.json` and run `node auth.js` again:

```bash
rm token.json
node auth.js
```

## Running Tests

Tests require a real Google Classroom course and will create and delete data.

```bash
# Set your course ID
export TEST_COURSE_ID=your_course_id_here

# Basic functional tests (one tool at a time)
node tests/test-basic.js

# Integration tests (cross-tool workflows)
node tests/test-integration.js
```

## Project Structure

```
google-classroom-mcp/
├── src/
│   └── index.ts          # MCP server -- all 43 tools
├── dist/
│   └── index.js          # Compiled output (run this)
├── tests/
│   ├── test-basic.js     # Functional tests for all tools
│   └── test-integration.js # Cross-tool workflow tests
├── auth.js               # OAuth2 token generator
├── credentials.json      # Your OAuth credentials (not committed)
├── token.json            # Generated auth token (not committed)
└── package.json
```

## Contributing

Issues and pull requests are welcome. When adding new tools, follow the existing pattern: declare the tool in `getTools()`, add a `case` in `handleToolCall()`, and write a test in `tests/test-basic.js`.

## License

MIT
