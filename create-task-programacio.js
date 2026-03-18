import { google } from 'googleapis';
import fs from 'fs';

async function createProgramacioTask() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  const courseId = '814265580615'; // Programació 25/26

  try {
    const response = await classroom.courses.courseWork.create({
      courseId,
      requestBody: {
        title: '🚀 Tasca de prova del Super-MCP',
        description: 'Aquesta tasca ha estat creada automàticament per validar el funcionament del teu nou connector MCP per a Google Classroom.',
        workType: 'ASSIGNMENT',
        state: 'PUBLISHED',
        maxPoints: 10
      }
    });
    
    console.log('✅ Tasca creada correctament!');
    console.log('Títol: ' + response.data.title);
    console.log('ID de la tasca: ' + response.data.id);
    console.log('Enllaç: ' + response.data.alternateLink);
  } catch (error) {
    console.error('Error al crear la tasca:', error.message);
  }
}

createProgramacioTask();