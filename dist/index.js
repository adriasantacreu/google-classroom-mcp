#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// NOTE: If classroom_grade_submission fails with permission errors,
// delete token.json and re-run the auth flow — the classroom.grades scope was added.
const SCOPES = [
    'https://www.googleapis.com/auth/classroom.courses',
    'https://www.googleapis.com/auth/classroom.coursework.students',
    'https://www.googleapis.com/auth/classroom.coursework.me',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials',
    'https://www.googleapis.com/auth/classroom.announcements',
    'https://www.googleapis.com/auth/classroom.rosters',
    'https://www.googleapis.com/auth/classroom.topics',
    'https://www.googleapis.com/auth/classroom.guardianlinks.students',
    'https://www.googleapis.com/auth/classroom.profile.emails',
    'https://www.googleapis.com/auth/classroom.profile.photos',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
];
class GoogleClassroomServer {
    server;
    classroom;
    drive;
    constructor() {
        this.server = new Server({ name: 'google-classroom-mcp', version: '2.0.0' }, { capabilities: { tools: {} } });
        this.setupHandlers();
    }
    async getAuthClient() {
        const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
        const tokenPath = process.env.GOOGLE_TOKEN_PATH || './token.json';
        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`Credentials file not found at ${credentialsPath}`);
        }
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        if (fs.existsSync(tokenPath)) {
            oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(tokenPath, 'utf8')));
        }
        else {
            throw new Error('Authentication token not found. Run auth flow first.');
        }
        return oAuth2Client;
    }
    async initApis() {
        if (!this.classroom || !this.drive) {
            const auth = await this.getAuthClient();
            this.classroom = google.classroom({ version: 'v1', auth });
            this.drive = google.drive({ version: 'v3', auth });
        }
        return { classroom: this.classroom, drive: this.drive };
    }
    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: this.getTools(),
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const { classroom, drive } = await this.initApis();
                return await this.handleToolCall(classroom, drive, request.params.name, request.params.arguments || {});
            }
            catch (error) {
                return {
                    content: [{ type: 'text', text: `Error: ${error.message}` }],
                    isError: true,
                };
            }
        });
    }
    // ─── HELPER: map attachment descriptors to Classroom API material format ───
    mapAttachments(attachments) {
        return attachments.map(att => {
            switch (att.type) {
                case 'driveFile': return { driveFile: { driveFile: { id: att.idOrUrl } } };
                case 'link': return { link: { url: att.idOrUrl } };
                case 'youtubeVideo': return { youtubeVideo: { id: att.idOrUrl } };
                case 'form': return { form: { formUrl: att.idOrUrl } };
                default: return att;
            }
        });
    }
    // ─── HELPER: parse "YYYY-MM-DD" and optional "HH:MM" into API date/time ───
    parseDueDateTime(dueDate, dueTime) {
        if (!dueDate)
            return {};
        const [year, month, day] = dueDate.split('-').map(Number);
        const [hours, minutes] = (dueTime || '23:59').split(':').map(Number);
        return {
            dueDate: { year, month, day },
            dueTime: { hours, minutes, seconds: 0, nanos: 0 },
        };
    }
    // ─── TOOLS DECLARATION ────────────────────────────────────────────────────
    getTools() {
        return [
            // ── COURSES ──────────────────────────────────────────────────────────
            {
                name: 'classroom_list_courses',
                description: 'List all Google Classroom courses. Supports filtering by state (ACTIVE, ARCHIVED, PROVISIONED).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseStates: { type: 'array', items: { type: 'string' }, description: 'ACTIVE, ARCHIVED, PROVISIONED' },
                        pageSize: { type: 'number', default: 50 },
                        pageToken: { type: 'string' },
                        fullData: { type: 'boolean', default: false, description: 'If true, return all fields (may be very large)' },
                    },
                },
            },
            {
                name: 'classroom_search_courses',
                description: 'Search courses by name or section (client-side filter, case-insensitive).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'String to search for in course name or section' },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'classroom_get_course',
                description: 'Get full details of a specific course by ID.',
                inputSchema: {
                    type: 'object',
                    properties: { courseId: { type: 'string' } },
                    required: ['courseId'],
                },
            },
            {
                name: 'classroom_create_course',
                description: 'Create a new course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        section: { type: 'string' },
                        description: { type: 'string' },
                        room: { type: 'string' },
                        ownerId: { type: 'string', default: 'me' },
                    },
                    required: ['name'],
                },
            },
            {
                name: 'classroom_update_course',
                description: 'Update course fields (name, section, description, room, state). State can be ACTIVE or ARCHIVED.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        name: { type: 'string' },
                        section: { type: 'string' },
                        description: { type: 'string' },
                        room: { type: 'string' },
                        state: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'PROVISIONED', 'DECLINED'] },
                    },
                    required: ['courseId'],
                },
            },
            {
                name: 'classroom_delete_course',
                description: 'Delete a course. The course will be archived first (required by the API) and then deleted.',
                inputSchema: {
                    type: 'object',
                    properties: { courseId: { type: 'string' } },
                    required: ['courseId'],
                },
            },
            // ── COURSEWORK (ASSIGNMENTS / QUESTIONS) ─────────────────────────────
            {
                name: 'classroom_list_assignments',
                description: 'List coursework (assignments/questions) for a course. Supports filtering by state.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        courseWorkStates: { type: 'array', items: { type: 'string' }, description: 'PUBLISHED, DRAFT, DELETED' },
                        pageSize: { type: 'number', default: 50 },
                        pageToken: { type: 'string' },
                    },
                    required: ['courseId'],
                },
            },
            {
                name: 'classroom_create_assignment',
                description: 'Create an assignment or question with optional attachments, due date, and topic.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        workType: { type: 'string', enum: ['ASSIGNMENT', 'SHORT_ANSWER_QUESTION', 'MULTIPLE_CHOICE_QUESTION'], default: 'ASSIGNMENT' },
                        state: { type: 'string', enum: ['PUBLISHED', 'DRAFT'], default: 'PUBLISHED' },
                        maxPoints: { type: 'number' },
                        dueDate: { type: 'string', description: 'YYYY-MM-DD' },
                        dueTime: { type: 'string', description: 'HH:MM (defaults to 23:59 if dueDate is set)' },
                        topicId: { type: 'string' },
                        attachments: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    type: { type: 'string', enum: ['driveFile', 'link', 'youtubeVideo', 'form'] },
                                    idOrUrl: { type: 'string' },
                                },
                            },
                        },
                    },
                    required: ['courseId', 'title'],
                },
            },
            {
                name: 'classroom_patch_assignment',
                description: 'Update specific fields of an existing assignment using updateMask.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string', description: 'Assignment ID' },
                        updateMask: { type: 'string', description: 'Comma-separated fields: title,description,dueDate,dueTime,maxPoints,topicId,state' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        maxPoints: { type: 'number' },
                        topicId: { type: 'string' },
                        dueDate: { type: 'string', description: 'YYYY-MM-DD' },
                        dueTime: { type: 'string', description: 'HH:MM' },
                        state: { type: 'string', enum: ['PUBLISHED', 'DRAFT'] },
                    },
                    required: ['courseId', 'id', 'updateMask'],
                },
            },
            {
                name: 'classroom_update_assignment',
                description: 'Full update of an assignment (replaces all mutable fields). NOTE: materials cannot be modified after creation — this is an API limitation.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        workType: { type: 'string', enum: ['ASSIGNMENT', 'SHORT_ANSWER_QUESTION', 'MULTIPLE_CHOICE_QUESTION'] },
                        state: { type: 'string', enum: ['PUBLISHED', 'DRAFT'] },
                        maxPoints: { type: 'number' },
                        dueDate: { type: 'string', description: 'YYYY-MM-DD' },
                        dueTime: { type: 'string', description: 'HH:MM' },
                        topicId: { type: 'string' },
                    },
                    required: ['courseId', 'id'],
                },
            },
            {
                name: 'classroom_delete_assignment',
                description: 'Delete (permanently) a coursework item.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string' },
                    },
                    required: ['courseId', 'id'],
                },
            },
            {
                name: 'classroom_move_to_topic',
                description: 'Move a coursework item to a topic. Pass empty string for topicId to remove from all topics.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string', description: 'Coursework ID' },
                        topicId: { type: 'string', description: 'Topic ID, or empty string to unassign' },
                    },
                    required: ['courseId', 'id', 'topicId'],
                },
            },
            // ── SUBMISSIONS & GRADING ─────────────────────────────────────────────
            {
                name: 'classroom_list_submissions',
                description: 'List student submissions for an assignment. Use "-" as courseWorkId to get all submissions for a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        courseWorkId: { type: 'string', description: 'Assignment ID or "-" for all' },
                        states: { type: 'array', items: { type: 'string' }, description: 'NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT' },
                        pageSize: { type: 'number' },
                    },
                    required: ['courseId', 'courseWorkId'],
                },
            },
            {
                name: 'classroom_grade_submission',
                description: 'Grade a student submission (sets assignedGrade and draftGrade). Requires classroom.grades OAuth scope.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        courseWorkId: { type: 'string' },
                        id: { type: 'string', description: 'Submission ID' },
                        grade: { type: 'number' },
                        draft: { type: 'boolean', default: false, description: 'If true, only sets draftGrade' },
                    },
                    required: ['courseId', 'courseWorkId', 'id', 'grade'],
                },
            },
            {
                name: 'classroom_return_submission',
                description: 'Return a graded submission to the student.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        courseWorkId: { type: 'string' },
                        id: { type: 'string', description: 'Submission ID' },
                    },
                    required: ['courseId', 'courseWorkId', 'id'],
                },
            },
            // ── TOPICS ────────────────────────────────────────────────────────────
            {
                name: 'classroom_list_topics',
                description: 'List all topics in a course.',
                inputSchema: {
                    type: 'object',
                    properties: { courseId: { type: 'string' } },
                    required: ['courseId'],
                },
            },
            {
                name: 'classroom_create_topic',
                description: 'Create a new topic/unit in a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        name: { type: 'string' },
                    },
                    required: ['courseId', 'name'],
                },
            },
            {
                name: 'classroom_patch_topic',
                description: 'Rename or update a topic.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string', description: 'Topic ID' },
                        name: { type: 'string' },
                    },
                    required: ['courseId', 'id', 'name'],
                },
            },
            {
                name: 'classroom_delete_topic',
                description: 'Delete a topic from a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string' },
                    },
                    required: ['courseId', 'id'],
                },
            },
            // ── MATERIALS ─────────────────────────────────────────────────────────
            {
                name: 'classroom_list_materials',
                description: 'List all non-graded materials for a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        pageSize: { type: 'number', default: 50 },
                    },
                    required: ['courseId'],
                },
            },
            {
                name: 'classroom_create_material',
                description: 'Create a study material post with optional attachments and topic.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        topicId: { type: 'string' },
                        attachments: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    type: { type: 'string', enum: ['driveFile', 'link', 'youtubeVideo', 'form'] },
                                    idOrUrl: { type: 'string' },
                                },
                            },
                        },
                    },
                    required: ['courseId', 'title'],
                },
            },
            {
                name: 'classroom_patch_material',
                description: 'Update fields of an existing material post.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string' },
                        updateMask: { type: 'string', description: 'Comma-separated: title,description,state,topicId' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        topicId: { type: 'string' },
                        state: { type: 'string', enum: ['PUBLISHED', 'DRAFT'] },
                    },
                    required: ['courseId', 'id', 'updateMask'],
                },
            },
            {
                name: 'classroom_delete_material',
                description: 'Delete a material post from a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string' },
                    },
                    required: ['courseId', 'id'],
                },
            },
            // ── ANNOUNCEMENTS ─────────────────────────────────────────────────────
            {
                name: 'classroom_list_announcements',
                description: 'List announcements for a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        pageSize: { type: 'number', default: 50 },
                    },
                    required: ['courseId'],
                },
            },
            {
                name: 'classroom_post_announcement',
                description: 'Post an announcement to the course stream.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        text: { type: 'string' },
                    },
                    required: ['courseId', 'text'],
                },
            },
            {
                name: 'classroom_patch_announcement',
                description: 'Edit an existing announcement.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string' },
                        text: { type: 'string' },
                    },
                    required: ['courseId', 'id', 'text'],
                },
            },
            {
                name: 'classroom_delete_announcement',
                description: 'Delete an announcement from a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        id: { type: 'string' },
                    },
                    required: ['courseId', 'id'],
                },
            },
            // ── ROSTER: STUDENTS ──────────────────────────────────────────────────
            {
                name: 'classroom_list_students',
                description: 'List all students in a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        pageSize: { type: 'number' },
                    },
                    required: ['courseId'],
                },
            },
            {
                name: 'classroom_add_student',
                description: 'Invite a student to a course by email (sends an enrollment invitation).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        email: { type: 'string' },
                    },
                    required: ['courseId', 'email'],
                },
            },
            {
                name: 'classroom_delete_student',
                description: 'Remove a student from a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        userId: { type: 'string', description: 'Student email or user ID' },
                    },
                    required: ['courseId', 'userId'],
                },
            },
            // ── ROSTER: TEACHERS ──────────────────────────────────────────────────
            {
                name: 'classroom_list_teachers',
                description: 'List all teachers (co-instructors) in a course.',
                inputSchema: {
                    type: 'object',
                    properties: { courseId: { type: 'string' } },
                    required: ['courseId'],
                },
            },
            {
                name: 'classroom_invite_teacher',
                description: 'Invite a teacher to co-instruct a course by email.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        email: { type: 'string' },
                    },
                    required: ['courseId', 'email'],
                },
            },
            {
                name: 'classroom_delete_teacher',
                description: 'Remove a teacher from a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        userId: { type: 'string', description: 'Teacher email or user ID' },
                    },
                    required: ['courseId', 'userId'],
                },
            },
            // ── USER PROFILES ─────────────────────────────────────────────────────
            {
                name: 'classroom_get_user_profile',
                description: 'Get a user profile by email or user ID.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: { type: 'string', description: 'Email or user ID' },
                    },
                    required: ['userId'],
                },
            },
            // ── RUBRICS ───────────────────────────────────────────────────────────
            {
                name: 'classroom_list_rubrics',
                description: 'List rubrics for a coursework assignment.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        courseWorkId: { type: 'string' },
                    },
                    required: ['courseId', 'courseWorkId'],
                },
            },
            {
                name: 'classroom_create_rubric',
                description: 'Create a rubric for an assignment.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        courseWorkId: { type: 'string' },
                        criteria: {
                            type: 'array',
                            description: 'Array of rubric criteria objects',
                            items: { type: 'object' },
                        },
                    },
                    required: ['courseId', 'courseWorkId', 'criteria'],
                },
            },
            {
                name: 'classroom_patch_rubric',
                description: 'Update rubric criteria for an assignment.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        courseWorkId: { type: 'string' },
                        id: { type: 'string', description: 'Rubric ID' },
                        criteria: {
                            type: 'array',
                            items: { type: 'object' },
                        },
                    },
                    required: ['courseId', 'courseWorkId', 'id', 'criteria'],
                },
            },
            {
                name: 'classroom_delete_rubric',
                description: 'Delete a rubric from an assignment.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        courseWorkId: { type: 'string' },
                        id: { type: 'string' },
                    },
                    required: ['courseId', 'courseWorkId', 'id'],
                },
            },
            // ── GUARDIANS ─────────────────────────────────────────────────────────
            {
                name: 'classroom_list_guardians',
                description: 'List guardians (parents) registered for a student.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        studentId: { type: 'string', description: 'Student email or user ID' },
                    },
                    required: ['studentId'],
                },
            },
            {
                name: 'classroom_invite_guardian',
                description: 'Send a guardian invitation to a parent email.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        studentId: { type: 'string' },
                        guardianEmail: { type: 'string' },
                    },
                    required: ['studentId', 'guardianEmail'],
                },
            },
            {
                name: 'classroom_delete_guardian',
                description: 'Remove a guardian relationship.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        studentId: { type: 'string' },
                        guardianId: { type: 'string' },
                    },
                    required: ['studentId', 'guardianId'],
                },
            },
            // ── DRIVE & ATTACHMENTS ───────────────────────────────────────────────
            {
                name: 'drive_upload_file',
                description: 'Upload a base64-encoded file to Google Drive. Returns the Drive file ID and URL.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        mimeType: { type: 'string', default: 'application/octet-stream' },
                        base64Content: { type: 'string' },
                    },
                    required: ['name', 'base64Content'],
                },
            },
            {
                name: 'classroom_upload_to_classroom',
                description: 'Upload a file to Google Drive and immediately attach it as a material to a course.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'string' },
                        title: { type: 'string', description: 'Material title' },
                        description: { type: 'string' },
                        topicId: { type: 'string' },
                        fileName: { type: 'string', description: 'File name for Drive' },
                        mimeType: { type: 'string', default: 'application/octet-stream' },
                        base64Content: { type: 'string' },
                    },
                    required: ['courseId', 'title', 'fileName', 'base64Content'],
                },
            },
        ];
    }
    // ─── TOOL DISPATCH ────────────────────────────────────────────────────────
    async handleToolCall(classroom, drive, name, args) {
        const ok = (data) => ({
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        });
        switch (name) {
            // ── COURSES ────────────────────────────────────────────────────────
            case 'classroom_list_courses': {
                const r = await classroom.courses.list({
                    courseStates: args.courseStates,
                    pageSize: args.pageSize ?? 50,
                    pageToken: args.pageToken,
                    fields: args.fullData
                        ? undefined
                        : 'courses(id,name,section,courseState,enrollmentCode,alternateLink,ownerId,updateTime),nextPageToken',
                });
                return ok(r.data.courses ?? []);
            }
            case 'classroom_search_courses': {
                const r = await classroom.courses.list({ pageSize: 100 });
                const q = args.query.toLowerCase();
                const filtered = (r.data.courses ?? []).filter(c => c.name?.toLowerCase().includes(q) ||
                    c.section?.toLowerCase().includes(q));
                return ok(filtered);
            }
            case 'classroom_get_course': {
                const r = await classroom.courses.get({ id: args.courseId });
                return ok(r.data);
            }
            case 'classroom_create_course': {
                const r = await classroom.courses.create({
                    requestBody: {
                        name: args.name,
                        section: args.section,
                        descriptionHeading: args.description,
                        room: args.room,
                        ownerId: args.ownerId ?? 'me',
                        courseState: 'ACTIVE',
                    },
                });
                return ok(r.data);
            }
            case 'classroom_update_course': {
                const body = {};
                const maskFields = [];
                if (args.name) {
                    body.name = args.name;
                    maskFields.push('name');
                }
                if (args.section) {
                    body.section = args.section;
                    maskFields.push('section');
                }
                if (args.description) {
                    body.descriptionHeading = args.description;
                    maskFields.push('descriptionHeading');
                }
                if (args.room) {
                    body.room = args.room;
                    maskFields.push('room');
                }
                if (args.state) {
                    body.courseState = args.state;
                    maskFields.push('courseState');
                }
                const r = await classroom.courses.patch({
                    id: args.courseId,
                    updateMask: maskFields.join(','),
                    requestBody: body,
                });
                return ok(r.data);
            }
            case 'classroom_delete_course': {
                // API requires ARCHIVED state before deletion
                await classroom.courses.patch({
                    id: args.courseId,
                    updateMask: 'courseState',
                    requestBody: { courseState: 'ARCHIVED' },
                });
                await classroom.courses.delete({ id: args.courseId });
                return ok({ deleted: true, courseId: args.courseId });
            }
            // ── COURSEWORK ─────────────────────────────────────────────────────
            case 'classroom_list_assignments': {
                const r = await classroom.courses.courseWork.list({
                    courseId: args.courseId,
                    courseWorkStates: args.courseWorkStates,
                    pageSize: args.pageSize ?? 50,
                    pageToken: args.pageToken,
                    fields: args.fullData
                        ? undefined
                        : 'courseWork(id,title,workType,state,maxPoints,dueDate,dueTime,topicId,creationTime,updateTime),nextPageToken',
                });
                return ok(r.data.courseWork ?? []);
            }
            case 'classroom_create_assignment': {
                const body = {
                    title: args.title,
                    description: args.description,
                    workType: args.workType ?? 'ASSIGNMENT',
                    state: args.state ?? 'PUBLISHED',
                    maxPoints: args.maxPoints,
                    topicId: args.topicId,
                    ...this.parseDueDateTime(args.dueDate, args.dueTime),
                };
                if (args.attachments?.length) {
                    body.materials = this.mapAttachments(args.attachments);
                }
                const r = await classroom.courses.courseWork.create({
                    courseId: args.courseId,
                    requestBody: body,
                });
                return ok(r.data);
            }
            case 'classroom_patch_assignment': {
                const body = {};
                if (args.title !== undefined)
                    body.title = args.title;
                if (args.description !== undefined)
                    body.description = args.description;
                if (args.maxPoints !== undefined)
                    body.maxPoints = args.maxPoints;
                if (args.topicId !== undefined)
                    body.topicId = args.topicId;
                if (args.state !== undefined)
                    body.state = args.state;
                if (args.dueDate) {
                    Object.assign(body, this.parseDueDateTime(args.dueDate, args.dueTime));
                }
                const r = await classroom.courses.courseWork.patch({
                    courseId: args.courseId,
                    id: args.id,
                    updateMask: args.updateMask,
                    requestBody: body,
                });
                return ok(r.data);
            }
            case 'classroom_update_assignment': {
                const body = {
                    title: args.title,
                    description: args.description,
                    workType: args.workType,
                    state: args.state,
                    maxPoints: args.maxPoints,
                    topicId: args.topicId,
                    ...this.parseDueDateTime(args.dueDate, args.dueTime),
                };
                const updateMask = 'title,description,maxPoints,topicId,dueDate,dueTime';
                const r = await classroom.courses.courseWork.patch({
                    courseId: args.courseId,
                    id: args.id,
                    updateMask,
                    requestBody: body,
                });
                return ok(r.data);
            }
            case 'classroom_delete_assignment': {
                await classroom.courses.courseWork.delete({
                    courseId: args.courseId,
                    id: args.id,
                });
                return ok({ deleted: true, id: args.id });
            }
            case 'classroom_move_to_topic': {
                const r = await classroom.courses.courseWork.patch({
                    courseId: args.courseId,
                    id: args.id,
                    updateMask: 'topicId',
                    requestBody: { topicId: args.topicId },
                });
                return ok(r.data);
            }
            // ── SUBMISSIONS & GRADING ──────────────────────────────────────────
            case 'classroom_list_submissions': {
                const r = await classroom.courses.courseWork.studentSubmissions.list({
                    courseId: args.courseId,
                    courseWorkId: args.courseWorkId,
                    states: args.states,
                    pageSize: args.pageSize,
                    fields: args.fullData
                        ? undefined
                        : 'studentSubmissions(id,courseWorkId,userId,state,assignedGrade,draftGrade,late,updateTime)',
                });
                return ok(r.data.studentSubmissions ?? []);
            }
            case 'classroom_grade_submission': {
                const gradeBody = args.draft
                    ? { draftGrade: args.grade }
                    : { draftGrade: args.grade, assignedGrade: args.grade };
                const updateMask = args.draft ? 'draftGrade' : 'assignedGrade,draftGrade';
                const r = await classroom.courses.courseWork.studentSubmissions.patch({
                    courseId: args.courseId,
                    courseWorkId: args.courseWorkId,
                    id: args.id,
                    updateMask,
                    requestBody: gradeBody,
                });
                return ok(r.data);
            }
            case 'classroom_return_submission': {
                const r = await classroom.courses.courseWork.studentSubmissions.return({
                    courseId: args.courseId,
                    courseWorkId: args.courseWorkId,
                    id: args.id,
                    requestBody: {},
                });
                return ok(r.data ?? { returned: true });
            }
            // ── TOPICS ─────────────────────────────────────────────────────────
            case 'classroom_list_topics': {
                const r = await classroom.courses.topics.list({ courseId: args.courseId });
                return ok(r.data.topic ?? []);
            }
            case 'classroom_create_topic': {
                const r = await classroom.courses.topics.create({
                    courseId: args.courseId,
                    requestBody: { name: args.name },
                });
                return ok(r.data);
            }
            case 'classroom_patch_topic': {
                const r = await classroom.courses.topics.patch({
                    courseId: args.courseId,
                    id: args.id,
                    updateMask: 'name',
                    requestBody: { name: args.name },
                });
                return ok(r.data);
            }
            case 'classroom_delete_topic': {
                await classroom.courses.topics.delete({
                    courseId: args.courseId,
                    id: args.id,
                });
                return ok({ deleted: true, id: args.id });
            }
            // ── MATERIALS ──────────────────────────────────────────────────────
            case 'classroom_list_materials': {
                const r = await classroom.courses.courseWorkMaterials.list({
                    courseId: args.courseId,
                    pageSize: args.pageSize ?? 50,
                    fields: args.fullData
                        ? undefined
                        : 'courseWorkMaterial(id,title,description,topicId,state,creationTime,updateTime)',
                });
                return ok(r.data.courseWorkMaterial ?? []);
            }
            case 'classroom_create_material': {
                const body = {
                    title: args.title,
                    description: args.description,
                    topicId: args.topicId,
                    state: 'PUBLISHED',
                };
                if (args.attachments?.length) {
                    body.materials = this.mapAttachments(args.attachments);
                }
                const r = await classroom.courses.courseWorkMaterials.create({
                    courseId: args.courseId,
                    requestBody: body,
                });
                return ok(r.data);
            }
            case 'classroom_patch_material': {
                const body = {};
                if (args.title !== undefined)
                    body.title = args.title;
                if (args.description !== undefined)
                    body.description = args.description;
                if (args.topicId !== undefined)
                    body.topicId = args.topicId;
                if (args.state !== undefined)
                    body.state = args.state;
                const r = await classroom.courses.courseWorkMaterials.patch({
                    courseId: args.courseId,
                    id: args.id,
                    updateMask: args.updateMask,
                    requestBody: body,
                });
                return ok(r.data);
            }
            case 'classroom_delete_material': {
                await classroom.courses.courseWorkMaterials.delete({
                    courseId: args.courseId,
                    id: args.id,
                });
                return ok({ deleted: true, id: args.id });
            }
            // ── ANNOUNCEMENTS ──────────────────────────────────────────────────
            case 'classroom_list_announcements': {
                const r = await classroom.courses.announcements.list({
                    courseId: args.courseId,
                    pageSize: args.pageSize ?? 50,
                    fields: args.fullData
                        ? undefined
                        : 'announcements(id,text,state,creationTime,updateTime)',
                });
                return ok(r.data.announcements ?? []);
            }
            case 'classroom_post_announcement': {
                const r = await classroom.courses.announcements.create({
                    courseId: args.courseId,
                    requestBody: { text: args.text, state: 'PUBLISHED' },
                });
                return ok(r.data);
            }
            case 'classroom_patch_announcement': {
                const r = await classroom.courses.announcements.patch({
                    courseId: args.courseId,
                    id: args.id,
                    updateMask: 'text',
                    requestBody: { text: args.text },
                });
                return ok(r.data);
            }
            case 'classroom_delete_announcement': {
                await classroom.courses.announcements.delete({
                    courseId: args.courseId,
                    id: args.id,
                });
                return ok({ deleted: true, id: args.id });
            }
            // ── ROSTER: STUDENTS ───────────────────────────────────────────────
            case 'classroom_list_students': {
                const r = await classroom.courses.students.list({
                    courseId: args.courseId,
                    pageSize: args.pageSize,
                    fields: args.fullData
                        ? undefined
                        : 'students(userId,profile(name,emailAddress))',
                });
                return ok(r.data.students ?? []);
            }
            case 'classroom_add_student': {
                // Uses invitations API — works for both same-domain and external accounts
                const r = await classroom.invitations.create({
                    requestBody: {
                        courseId: args.courseId,
                        userId: args.email,
                        role: 'STUDENT',
                    },
                });
                return ok(r.data);
            }
            case 'classroom_delete_student': {
                await classroom.courses.students.delete({
                    courseId: args.courseId,
                    userId: args.userId,
                });
                return ok({ deleted: true, userId: args.userId });
            }
            // ── ROSTER: TEACHERS ───────────────────────────────────────────────
            case 'classroom_list_teachers': {
                const r = await classroom.courses.teachers.list({ courseId: args.courseId });
                return ok(r.data.teachers ?? []);
            }
            case 'classroom_invite_teacher': {
                const r = await classroom.invitations.create({
                    requestBody: {
                        courseId: args.courseId,
                        userId: args.email,
                        role: 'TEACHER',
                    },
                });
                return ok(r.data);
            }
            case 'classroom_delete_teacher': {
                await classroom.courses.teachers.delete({
                    courseId: args.courseId,
                    userId: args.userId,
                });
                return ok({ deleted: true, userId: args.userId });
            }
            // ── USER PROFILES ──────────────────────────────────────────────────
            case 'classroom_get_user_profile': {
                const r = await classroom.userProfiles.get({ userId: args.userId });
                return ok(r.data);
            }
            // ── RUBRICS ────────────────────────────────────────────────────────
            case 'classroom_list_rubrics': {
                const rubrics = classroom.courses.courseWork.rubrics;
                const r = await rubrics.list({ courseId: args.courseId, courseWorkId: args.courseWorkId });
                return ok(r.data.rubrics ?? []);
            }
            case 'classroom_create_rubric': {
                const rubrics = classroom.courses.courseWork.rubrics;
                const r = await rubrics.create({
                    courseId: args.courseId,
                    courseWorkId: args.courseWorkId,
                    requestBody: { criteria: args.criteria },
                });
                return ok(r.data);
            }
            case 'classroom_patch_rubric': {
                const rubrics = classroom.courses.courseWork.rubrics;
                const r = await rubrics.patch({
                    courseId: args.courseId,
                    courseWorkId: args.courseWorkId,
                    id: args.id,
                    updateMask: 'criteria',
                    requestBody: { criteria: args.criteria },
                });
                return ok(r.data);
            }
            case 'classroom_delete_rubric': {
                const rubrics = classroom.courses.courseWork.rubrics;
                await rubrics.delete({ courseId: args.courseId, courseWorkId: args.courseWorkId, id: args.id });
                return ok({ deleted: true, id: args.id });
            }
            // ── GUARDIANS ──────────────────────────────────────────────────────
            case 'classroom_list_guardians': {
                const r = await classroom.userProfiles.guardians.list({
                    studentId: args.studentId,
                });
                return ok(r.data.guardians ?? []);
            }
            case 'classroom_invite_guardian': {
                const r = await classroom.userProfiles.guardianInvitations.create({
                    studentId: args.studentId,
                    requestBody: { invitedEmailAddress: args.guardianEmail },
                });
                return ok(r.data);
            }
            case 'classroom_delete_guardian': {
                await classroom.userProfiles.guardians.delete({
                    studentId: args.studentId,
                    guardianId: args.guardianId,
                });
                return ok({ deleted: true, guardianId: args.guardianId });
            }
            // ── DRIVE & ATTACHMENTS ────────────────────────────────────────────
            case 'drive_upload_file': {
                const buffer = Buffer.from(args.base64Content, 'base64');
                const mimeType = args.mimeType ?? 'application/octet-stream';
                const r = await drive.files.create({
                    requestBody: { name: args.name, mimeType },
                    media: { mimeType, body: Readable.from(buffer) },
                    fields: 'id,name,webViewLink',
                });
                return ok(r.data);
            }
            case 'classroom_upload_to_classroom': {
                // 1. Upload file to Drive
                const buffer = Buffer.from(args.base64Content, 'base64');
                const mimeType = args.mimeType ?? 'application/octet-stream';
                const fileResp = await drive.files.create({
                    requestBody: { name: args.fileName, mimeType },
                    media: { mimeType, body: Readable.from(buffer) },
                    fields: 'id,name,webViewLink',
                });
                const fileId = fileResp.data.id;
                // 2. Create material in the course attached to the Drive file
                const matResp = await classroom.courses.courseWorkMaterials.create({
                    courseId: args.courseId,
                    requestBody: {
                        title: args.title,
                        description: args.description,
                        topicId: args.topicId,
                        state: 'PUBLISHED',
                        materials: [{ driveFile: { driveFile: { id: fileId } } }],
                    },
                });
                return ok({ driveFile: fileResp.data, material: matResp.data });
            }
            default:
                throw new Error(`Tool not implemented: ${name}`);
        }
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Google Classroom MCP server v2.0.0 running on stdio');
    }
}
const server = new GoogleClassroomServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map