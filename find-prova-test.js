import { google } from 'googleapis';
import fs from 'fs';

async function findProvaTestTask() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  const courseId = '720436012571'; // Curs de proves [Meus]

  try {
    const response = await classroom.courses.courseWork.list({ courseId });
    const tasks = response.data.courseWork || [];
    const targetTask = tasks.find(t => t.title === 'PROVA TEST');
    
    if (targetTask) {
      console.log('🚀 TROBADA! [ID: ' + targetTask.id + '] ' + targetTask.title);
    } else {
      console.log('No hem trobat cap tasca amb el títol exactament "PROVA TEST". Aquí tens les tasques actuals:');
      tasks.forEach(t => console.log(`- [${t.id}] ${t.title}`));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findProvaTestTask();