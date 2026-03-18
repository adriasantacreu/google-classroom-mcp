#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { google, classroom_v1, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/classroom.topics',
  'https://www.googleapis.com/auth/classroom.guardianlinks.students',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
  'https://www.googleapis.com/auth/drive.file',
];

class GoogleClassroomServer {
  private server: Server;
  private classroom?: classroom_v1.Classroom;
  private drive?: drive_v3.Drive;

  constructor() {
    this.server = new Server(
      {
        name: 'google-classroom-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private async getAuthClient(): Promise<OAuth2Client> {
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
    } else {
      throw new Error('Authentication token not found. Run auth flow first.');
    }

    return oAuth2Client;
  }

  private async initApis() {
    if (!this.classroom || !this.drive) {
      const auth = await this.getAuthClient();
      this.classroom = google.classroom({ version: 'v1', auth });
      this.drive = google.drive({ version: 'v3', auth });
    }
    return { classroom: this.classroom, drive: this.drive };
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { classroom, drive } = await this.initApis();
        return await this.handleToolCall(classroom, drive, request.params.name, request.params.arguments || {});
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      // COURSE TOOLS
      {
        name: 'classroom_list_courses',
        description: 'List all Google Classroom courses. Supports filtering by state (ACTIVE, ARCHIVED, PROVISIONED).',
        inputSchema: {
          type: 'object',
          properties: {
            courseStates: { type: 'array', items: { type: 'string' }, description: 'ACTIVE, ARCHIVED, PROVISIONED' },
            pageSize: { type: 'number', default: 50 },
            pageToken: { type: 'string' }
          }
        }
      },
      {
        name: 'classroom_search_courses',
        description: 'Search courses by name or section using a string or regex.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'String to search for in course name' },
          },
          required: ['query']
        }
      },
      {
        name: 'classroom_get_course',
        description: 'Get full details of a specific course by ID.',
        inputSchema: {
          type: 'object',
          properties: { courseId: { type: 'string' } },
          required: ['courseId']
        }
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
            ownerId: { type: 'string', default: 'me' }
          },
          required: ['name']
        }
      },

      // COURSEWORK TOOLS (TASKS)
      {
        name: 'classroom_list_assignments',
        description: 'List coursework (assignments/questions) for a course. Supports filtering by state.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: { type: 'string' },
            courseWorkStates: { type: 'array', items: { type: 'string' }, description: 'PUBLISHED, DRAFT, DELETED' },
            pageSize: { type: 'number', default: 50 },
            pageToken: { type: 'string' }
          },
          required: ['courseId']
        }
      },
      {
        name: 'classroom_create_assignment',
        description: 'Create an assignment with support for various attachments.',
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
            dueTime: { type: 'string', description: 'HH:MM' },
            topicId: { type: 'string' },
            attachments: { 
              type: 'array', 
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['driveFile', 'link', 'youtubeVideo', 'form'] },
                  idOrUrl: { type: 'string' }
                }
              }
            }
          },
          required: ['courseId', 'title']
        }
      },
      {
        name: 'classroom_patch_assignment',
        description: 'Update specific fields of an existing assignment.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: { type: 'string' },
            id: { type: 'string', description: 'Assignment ID' },
            updateMask: { type: 'string', description: 'Comma-separated fields: title,description,dueDate,dueTime,maxPoints,topicId' },
            title: { type: 'string' },
            description: { type: 'string' },
            maxPoints: { type: 'number' },
            topicId: { type: 'string' }
          },
          required: ['courseId', 'id', 'updateMask']
        }
      },

      // SUBMISSIONS & GRADING
      {
        name: 'classroom_list_submissions',
        description: 'List student submissions for an assignment. Supports filtering by state.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: { type: 'string' },
            courseWorkId: { type: 'string' },
            states: { type: 'array', items: { type: 'string' }, description: 'NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT' },
            pageSize: { type: 'number' }
          },
          required: ['courseId', 'courseWorkId']
        }
      },
      {
        name: 'classroom_grade_submission',
        description: 'Grade a student submission (assignedGrade and/or draftGrade).',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: { type: 'string' },
            courseWorkId: { type: 'string' },
            id: { type: 'string', description: 'Submission ID' },
            grade: { type: 'number' },
            draft: { type: 'boolean', default: false, description: 'If true, only sets draftGrade' }
          },
          required: ['courseId', 'courseWorkId', 'id', 'grade']
        }
      },

      // TOPICS & MATERIALS
      {
        name: 'classroom_list_topics',
        description: 'List all topics in a course.',
        inputSchema: {
          type: 'object',
          properties: { courseId: { type: 'string' } },
          required: ['courseId']
        }
      },
      {
        name: 'classroom_create_topic',
        description: 'Create a new topic.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['courseId', 'name']
        }
      },
      {
        name: 'classroom_create_material',
        description: 'Create study material with attachments.',
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
                  idOrUrl: { type: 'string' }
                }
              }
            }
          },
          required: ['courseId', 'title']
        }
      },

      // ROSTER (STUDENTS & TEACHERS)
      {
        name: 'classroom_list_students',
        description: 'List all students in a course.',
        inputSchema: {
          type: 'object',
          properties: { courseId: { type: 'string' }, pageSize: { type: 'number' } },
          required: ['courseId']
        }
      },
      {
        name: 'classroom_add_student',
        description: 'Add or invite a student by email.',
        inputSchema: {
          type: 'object',
          properties: { courseId: { type: 'string' }, email: { type: 'string' } },
          required: ['courseId', 'email']
        }
      },

      // ANNOUNCEMENTS
      {
        name: 'classroom_post_announcement',
        description: 'Post an announcement to the stream.',
        inputSchema: {
          type: 'object',
          properties: { courseId: { type: 'string' }, text: { type: 'string' } },
          required: ['courseId', 'text']
        }
      },

      // DRIVE TOOLS
      {
        name: 'drive_upload_file',
        description: 'Upload a file to Google Drive to be attached later.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            mimeType: { type: 'string' },
            base64Content: { type: 'string' }
          },
          required: ['name', 'base64Content']
        }
      }
    ];
  }

  private async handleToolCall(classroom: classroom_v1.Classroom, drive: drive_v3.Drive, name: string, args: any) {
    switch (name) {
      case 'classroom_list_courses':
        const coursesResp = await classroom.courses.list(args);
        return { content: [{ type: 'text', text: JSON.stringify(coursesResp.data.courses || [], null, 2) }] };

      case 'classroom_search_courses':
        const allCourses = await classroom.courses.list({ pageSize: 100 });
        const filtered = (allCourses.data.courses || []).filter(c => 
          c.name?.toLowerCase().includes(args.query.toLowerCase()) || 
          c.section?.toLowerCase().includes(args.query.toLowerCase())
        );
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };

      case 'classroom_get_course':
        const courseDetail = await classroom.courses.get({ id: args.courseId });
        return { content: [{ type: 'text', text: JSON.stringify(courseDetail.data, null, 2) }] };

      case 'classroom_create_assignment':
        const assignmentBody: any = {
          title: args.title,
          description: args.description,
          workType: args.workType,
          state: args.state,
          maxPoints: args.maxPoints,
          topicId: args.topicId
        };
        if (args.dueDate) {
          const [year, month, day] = args.dueDate.split('-').map(Number);
          assignmentBody.dueDate = { year, month, day };
        }
        if (args.attachments) {
          assignmentBody.materials = this.mapAttachments(args.attachments);
        }
        const newAssignment = await classroom.courses.courseWork.create({ courseId: args.courseId, requestBody: assignmentBody });
        return { content: [{ type: 'text', text: JSON.stringify(newAssignment.data, null, 2) }] };

      case 'classroom_patch_assignment':
        const patchBody: any = {};
        if (args.title) patchBody.title = args.title;
        if (args.description) patchBody.description = args.description;
        if (args.maxPoints !== undefined) patchBody.maxPoints = args.maxPoints;
        if (args.topicId) patchBody.topicId = args.topicId;
        const patched = await classroom.courses.courseWork.patch({
          courseId: args.courseId,
          id: args.id,
          updateMask: args.updateMask,
          requestBody: patchBody
        });
        return { content: [{ type: 'text', text: JSON.stringify(patched.data, null, 2) }] };

      case 'classroom_list_submissions':
        const subResp = await classroom.courses.courseWork.studentSubmissions.list(args);
        return { content: [{ type: 'text', text: JSON.stringify(subResp.data.studentSubmissions || [], null, 2) }] };

      case 'classroom_grade_submission':
        const gradeBody: any = {};
        if (args.draft) gradeBody.draftGrade = args.grade;
        else {
          gradeBody.draftGrade = args.grade;
          gradeBody.assignedGrade = args.grade;
        }
        const graded = await classroom.courses.courseWork.studentSubmissions.patch({
          courseId: args.courseId,
          courseWorkId: args.courseWorkId,
          id: args.id,
          updateMask: args.draft ? 'draftGrade' : 'assignedGrade,draftGrade',
          requestBody: gradeBody
        });
        return { content: [{ type: 'text', text: JSON.stringify(graded.data, null, 2) }] };

      case 'classroom_create_material':
        const matBody: any = { title: args.title, description: args.description, topicId: args.topicId, state: 'PUBLISHED' };
        if (args.attachments) {
          matBody.materials = this.mapAttachments(args.attachments);
        }
        const newMat = await classroom.courses.courseWorkMaterials.create({ courseId: args.courseId, requestBody: matBody });
        return { content: [{ type: 'text', text: JSON.stringify(newMat.data, null, 2) }] };

      case 'drive_upload_file':
        const driveFile = await drive.files.create({
          requestBody: { name: args.name, mimeType: args.mimeType },
          media: { mimeType: args.mimeType, body: Buffer.from(args.base64Content, 'base64') }
        });
        return { content: [{ type: 'text', text: JSON.stringify(driveFile.data, null, 2) }] };

      // Helper tools (delegating to simple handlers)
      case 'classroom_list_students':
        const students = await classroom.courses.students.list({ courseId: args.courseId, pageSize: args.pageSize });
        return { content: [{ type: 'text', text: JSON.stringify(students.data.students || [], null, 2) }] };

      case 'classroom_list_topics':
        const topics = await classroom.courses.topics.list({ courseId: args.courseId });
        return { content: [{ type: 'text', text: JSON.stringify(topics.data.topic || [], null, 2) }] };

      case 'classroom_post_announcement':
        const ann = await classroom.courses.announcements.create({ courseId: args.courseId, requestBody: { text: args.text, state: 'PUBLISHED' } });
        return { content: [{ type: 'text', text: JSON.stringify(ann.data, null, 2) }] };

      default:
        throw new Error(`Tool not implemented: ${name}`);
    }
  }

  private mapAttachments(attachments: any[]) {
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google Classroom MCP server running on stdio');
  }
}

const server = new GoogleClassroomServer();
server.run().catch(console.error);
