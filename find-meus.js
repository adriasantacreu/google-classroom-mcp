import { google } from 'googleapis';
import fs from 'fs';

async function findAllCourses() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  
  try {
    const response = await classroom.courses.list({ pageSize: 100 });
    const courses = response.data.courses || [];
    
    console.log('--- BUSCANT CURS DE PROVES ---');
    const meusCourses = courses.filter(c => c.name.toLowerCase().includes('meus'));
    
    if (meusCourses.length === 0) {
      console.log('No hem trobat cap curs amb "meus". Aquí tens tots els teus cursos:');
      courses.forEach(c => console.log(`- [${c.id}] ${c.name}`));
    } else {
      meusCourses.forEach(c => console.log(`🚀 TROBAT! [${c.id}] ${c.name}`));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findAllCourses();