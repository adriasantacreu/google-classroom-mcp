# Google Classroom MCP Server

Complete Model Context Protocol (MCP) server for managing Google Classroom through AI assistants.

## Features

- **Course Management**: List, search, create, and delete courses.
- **Universal Content Creation**: Create assignments and study materials with multiple attachments (Drive files, Links, YouTube, Forms) in a single call.
- **Discovery**: Search courses and assignments by name using smart queries.
- **Roster & People**: Manage students and teachers, including invitations and guardian links.
- **Grading Workflow**: List submissions and grade student work directly.
- **Drive Integration**: Built-in file upload capability to support complex attachment workflows.

## ??? Tools Included (25 Total)

- classroom_list_courses: Filtered list of courses.
- classroom_search_courses: Find courses by name/regex.
- classroom_create_assignment: Parametric task creation with multi-attachment support.
- classroom_patch_assignment: Targeted updates using updateMask.
- drive_upload_file: Base64 upload to Google Drive.
- ... and 20 more.

## ?? Validated in Production

This server has been strictly tested with production Google Classroom data, validating:
1. OAuth2 Authentication flow.
2. Multi-attachment creation (PDF + Link).
3. Differential updates (patching description/title).
4. Search-based discovery workflow.

## Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com).
2. Enable Classroom and Drive APIs.
3. Download credentials.json (Desktop App).
4. Run 
ode auth.js to generate 	oken.json.
5. Configure your MCP client (e.g., Claude Desktop).
