import { google } from 'googleapis';
import fs from 'fs';

async function deleteProgramacioTask() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  const courseId = '814265580615'; // Programació 25/26
  const assignmentId = '856469843649'; // La tasca que acabem de crear

  try {
    await classroom.courses.courseWork.delete({
      courseId,
      id: assignmentId
    });
    
    console.log('✅ Tasca eliminada correctament!');
  } catch (error) {
    console.error('Error al eliminar la tasca:', error.message);
  }
}

deleteProgramacioTask();